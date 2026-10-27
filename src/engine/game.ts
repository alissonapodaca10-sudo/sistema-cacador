// Pure game rules, ported from the Android app's Game.kt. Every action takes a state and returns the
// next state plus the System messages to show.

import {
  ACHIEVEMENTS, buffAmount, currentHp, enemyOf, type Gate, gateById, HAIR_COLORS, HAIR_STYLES, type Item, itemArt,
  bonusText, RARITIES, rankFor, rankTitle, SKILLS, type SkillId, stagesOf, starterTasks,
} from "./catalog";
import {
  ATTRIBUTES, type AppState, type AttributeId, type Direction, type GateRun, type HunterClass, HUNTER_CLASSES, newId,
  type ScoreRecord, type Stats, type SystemMessage, type Task,
} from "./model";
import {
  ADJUST_COST, bossDamage, CLASS_CHANGE_COST, CLASS_LEVEL, classBonus, critChance, CRIT_MULTIPLIER, delta, effective,
  expGain, fmt1, goldGain, hpLoss, isDueOn, MAX_HP, maxMp, POTION_COST, POTION_HEAL, priorityOf, toNextLevel,
} from "./rules";

export interface Outcome {
  state: AppState;
  messages: SystemMessage[];
}

const LOG_SIZE = 6;
const out = (state: AppState, messages: SystemMessage[] = []): Outcome => ({ state, messages });
const info = (title: string, body: string): SystemMessage => ({ kind: "INFO", title, body });
const findTask = (s: AppState, id: string) => s.tasks.find((t) => t.id === id);
const replace = (s: AppState, task: Task): AppState => ({ ...s, tasks: s.tasks.map((t) => (t.id === task.id ? task : t)) });
const emptyRecord = (): ScoreRecord => ({ exp: 0, gp: 0, valueDelta: 0, bossDamage: 0, gateId: null, stage: 0 });

export class Game {
  constructor(private readonly random: () => number = Math.random) {}

  onboard(state: AppState, name: string, today: number): Outcome {
    return out(
      {
        ...state,
        onboarded: true,
        hunterName: name.trim() || "Caçador",
        tasks: state.tasks.length ? state.tasks : starterTasks(),
        lastCronDay: today,
      },
      [info("BEM-VINDO, JOGADOR", "Complete suas missões para ganhar XP e ouro. Falhar nas missões diárias causa dano.")],
    );
  }

  scoreHabit(state: AppState, id: string, direction: Direction): Outcome {
    if (state.dead) return out(state);
    const task = findTask(state, id);
    if (!task || task.type !== "HABIT") return out(state);
    if ((direction === "UP" && !task.up) || (direction === "DOWN" && !task.down)) return out(state);
    const messages: SystemMessage[] = [];
    const d = delta(task, direction);
    const updated: Task = {
      ...task,
      value: task.value + d,
      counterUp: task.counterUp + (direction === "UP" ? 1 : 0),
      counterDown: task.counterDown + (direction === "DOWN" ? 1 : 0),
    };
    let next = replace(state, updated);
    next = d > 0 ? this.gain(next, task, d, messages)[0] : this.damage(next, task, d, messages);
    return this.finish(next, messages);
  }

  toggleDaily(state: AppState, id: string): Outcome {
    const task = findTask(state, id);
    if (!task || task.type !== "DAILY") return out(state);
    return task.completed ? this.undo(state, task) : this.complete(state, task);
  }

  toggleTodo(state: AppState, id: string): Outcome {
    const task = findTask(state, id);
    if (!task || task.type !== "TODO") return out(state);
    return task.completed ? this.undo(state, task) : this.complete(state, task);
  }

  toggleChecklistItem(state: AppState, taskId: string, itemId: string): Outcome {
    const task = findTask(state, taskId);
    if (!task) return out(state);
    return out(replace(state, { ...task, checklist: task.checklist.map((c) => (c.id === itemId ? { ...c, completed: !c.completed } : c)) }));
  }

  buyReward(state: AppState, id: string): Outcome {
    const task = findTask(state, id);
    if (!task || task.type !== "REWARD") return out(state);
    return this.spend(state, task.cost, `Recompensa obtida: ${task.text}`, (s) => s);
  }

  buyPotion(state: AppState): Outcome {
    if (state.stats.hp >= MAX_HP) return out(state, [info("AVISO", "Seu HP já está cheio.")]);
    return this.spend(state, POTION_COST, `HP restaurado em ${POTION_HEAL}.`, (s) => ({ ...s, stats: { ...s.stats, hp: Math.min(MAX_HP, s.stats.hp + POTION_HEAL) } }));
  }

  allocate(state: AppState, attribute: AttributeId): Outcome {
    const s = state.stats;
    if (s.points <= 0) return out(state);
    const key = ({ STR: "str", INT: "int", CON: "con", PER: "per" } as const)[attribute];
    return out({ ...state, stats: { ...s, [key]: s[key] + 1, points: s.points - 1 } });
  }

  useSkill(state: AppState, skillId: SkillId): Outcome {
    if (state.dead) return out(state);
    const skill = SKILLS[skillId];
    const stats = state.stats;
    if (stats.lvl < skill.unlockLevel) return out(state, [info("HABILIDADE BLOQUEADA", `Disponível no nível ${skill.unlockLevel}.`)]);
    if (!state.learnedSkills.includes(skillId)) return out(state, [info("HABILIDADE NÃO APRENDIDA", `Aprenda ${skill.title} na Loja.`)]);
    if (stats.mp < skill.mpCost) return out(state, [info("MANA INSUFICIENTE", `${skill.title} custa ${skill.mpCost} MP.`)]);
    const paid: AppState = {
      ...state,
      stats: { ...stats, mp: stats.mp - skill.mpCost },
      counters: { ...state.counters, skillsUsed: state.counters.skillsUsed + 1 },
    };
    const amount = buffAmount(stats.lvl);
    let next: AppState;
    let body: string;
    switch (skillId) {
      case "RECOVERY":
        next = { ...paid, stats: { ...paid.stats, hp: Math.min(MAX_HP, paid.stats.hp + 15) } };
        body = "HP restaurado em 15.";
        break;
      case "FOCUS":
        next = { ...paid, buffs: { ...paid.buffs, int: paid.buffs.int + amount } };
        body = `INT +${amount} até a virada do dia.`;
        break;
      case "HUNTER_INSTINCT":
        next = { ...paid, buffs: { ...paid.buffs, per: paid.buffs.per + amount } };
        body = `PER +${amount} até a virada do dia.`;
        break;
      case "STEALTH":
        next = { ...paid, stealthCharges: paid.stealthCharges + 2 };
        body = `Até ${paid.stealthCharges + 2} missões diárias não causarão dano na próxima virada.`;
        break;
    }
    return this.finish(next, [info(`HABILIDADE ATIVADA: ${skill.title.toUpperCase()}`, body)]);
  }

  /** Design choice for death: lose a level, all gold and current XP, then return at full HP. */
  revive(state: AppState): Outcome {
    if (!state.dead) return out(state);
    const s = state.stats;
    return this.finish(
      { ...state, dead: false, stats: { ...s, hp: MAX_HP, lvl: Math.max(1, s.lvl - 1), exp: 0, gp: 0 }, counters: { ...state.counters, deaths: state.counters.deaths + 1 } },
      [info("RETORNO", "O Sistema concedeu outra chance. Não falhe novamente.")],
    );
  }

  upsertTask(state: AppState, task: Task): Outcome {
    const exists = state.tasks.some((t) => t.id === task.id);
    return out({ ...state, tasks: exists ? state.tasks.map((t) => (t.id === task.id ? task : t)) : [...state.tasks, task] });
  }

  deleteTask(state: AppState, id: string): Outcome {
    return out({ ...state, tasks: state.tasks.filter((t) => t.id !== id) });
  }

  clearCompletedTodos(state: AppState): Outcome {
    return out({ ...state, tasks: state.tasks.filter((t) => !(t.type === "TODO" && t.completed)) });
  }

  /**
   * Daily reset. A daily counts as missed once if it was due and unfinished on the last active day,
   * or due on any skipped day (up to 7).
   */
  cron(state: AppState, today: number): Outcome {
    if (!state.onboarded || state.lastCronDay >= today) return out(state);
    const lastActive = Math.max(state.lastCronDay, today - 7);
    const skipped: number[] = [];
    for (let d = lastActive + 1; d < today; d++) skipped.push(d);
    const attrs = effective(state);

    let stealth = state.stealthCharges;
    let avoided = 0;
    let missed = 0;
    let due = 0;
    let hpChange = 0;
    let unprotectedPriority = 0;
    const tasks = state.tasks.map((task): Task => {
      switch (task.type) {
        case "DAILY": {
          const dueLastActive = isDueOn(task, lastActive);
          const dueSkipped = skipped.some((d) => isDueOn(task, d));
          const wasMissed = (dueLastActive && !task.completed) || dueSkipped;
          if (dueLastActive || dueSkipped) due++;
          const reset: Task = { ...task, completed: false, checklist: task.checklist.map((c) => ({ ...c, completed: false })), lastScore: null };
          if (!wasMissed) return reset;
          missed++;
          const d = delta(task, "DOWN");
          if (stealth > 0) {
            stealth--;
            avoided++;
          } else {
            const done = task.checklist.filter((c) => c.completed).length;
            const unfinished = task.checklist.length === 0 ? 1 : 1 - done / task.checklist.length;
            hpChange += hpLoss(d, priorityOf(task), attrs) * unfinished;
            unprotectedPriority += priorityOf(task);
          }
          return { ...reset, value: task.value + d, streak: 0 };
        }
        case "TODO":
          return task.completed ? task : { ...task, value: task.value + delta(task, "DOWN") };
        case "HABIT":
          return { ...task, counterUp: 0, counterDown: 0 };
        default:
          return task;
      }
    });

    let next: AppState = { ...state, tasks, buffs: { str: 0, int: 0, con: 0, per: 0 }, stealthCharges: 0, lastCronDay: today };
    const mp = maxMp(next);
    next = { ...next, stats: { ...next.stats, mp: Math.min(mp, next.stats.mp + mp * 0.1) } };

    const messages: SystemMessage[] = [];
    const boss = gateById(state.gate?.gateId);
    const attacker = boss && state.gate ? enemyOf(state.gate, boss).name : null;
    const bossHit = boss ? -Math.round(boss.bossStrength * unprotectedPriority * 2 * 10) / 10 : 0;
    hpChange = Math.round((hpChange + bossHit) * 10) / 10;
    if (missed > 0) {
      const parts = [`Missões diárias não cumpridas: ${missed}.`];
      if (avoided > 0) parts.push(`Furtividade evitou o dano de ${avoided}.`);
      if (attacker && bossHit < 0) parts.push(`${attacker} contra-atacou: ${fmt1(-bossHit)} HP.`);
      parts.push(`Dano total: ${fmt1(-hpChange)} HP.`);
      messages.push({ kind: "PENALTY", title: "PENALIDADE", body: parts.join("\n") });
    } else if (due > 0) {
      messages.push(info("MISSÃO DIÁRIA CONCLUÍDA", "Todas as missões diárias foram cumpridas. Continue assim."));
    }
    if (hpChange < 0) next = this.applyHp(next, hpChange, messages);
    return this.finish(next, messages);
  }

  startGate(state: AppState, gate: Gate): Outcome {
    if (state.dead) return out(state);
    if (state.gate) return out(state, [info("PORTAL ATIVO", "Feche o portal atual antes de entrar em outro.")]);
    if (state.stats.lvl < gate.minLevel) return out(state, [info("ACESSO NEGADO", `Portais Rank ${gate.rank} exigem nível ${gate.minLevel}.`)]);
    return out(
      { ...state, gate: { gateId: gate.id, stage: 0, enemyHp: stagesOf(gate)[0].hp, log: [`Você entrou em ${gate.title}.`], strikes: 0, hits: [] } },
      [
        info(
          "PORTAL ABERTO",
          `Inimigos no caminho: ${gate.mobs.length}× ${gate.mobs[0].name}.\nChefe: ${gate.boss.name}.\n` +
            "Cada missão concluída é um ataque. Missões diárias falhadas permitem que os monstros contra-ataquem.",
        ),
      ],
    );
  }

  abandonGate(state: AppState): Outcome {
    return out({ ...state, gate: null });
  }

  /** Buys [item] and equips it right away. */
  buyItem(state: AppState, item: Item): Outcome {
    if (state.ownedItems.includes(item.id)) return this.equip(state, item);
    const gate = gateById(item.requiresGate);
    if (state.stats.lvl < item.minLevel) return out(state, [info("NÍVEL INSUFICIENTE", `${item.title} exige nível ${item.minLevel}.`)]);
    if (gate && !state.clearedGates.includes(gate.id)) {
      return out(state, [info("REQUISITO", `Feche o portal ${gate.title} (Rank ${gate.rank}) para obter ${item.title}.`)]);
    }
    if (state.stats.gp < item.price) return out(state, [info("OURO INSUFICIENTE", `${item.title} custa ${item.price} de ouro.`)]);
    const bought: AppState = {
      ...state,
      stats: { ...state.stats, gp: state.stats.gp - item.price },
      ownedItems: [...state.ownedItems, item.id],
      counters: { ...state.counters, purchases: state.counters.purchases + 1 },
    };
    return this.finish(this.equip(bought, item).state, [
      { kind: "ITEM", title: "ITEM OBTIDO", body: `${item.title} · ${RARITIES[item.rarity].label}\n${bonusText(item)}`, art: itemArt(item) },
    ]);
  }

  equip(state: AppState, item: Item): Outcome {
    if (!state.ownedItems.includes(item.id)) return out(state);
    return out(item.slot === "WEAPON" ? { ...state, weapon: item.id } : { ...state, outfit: item.id });
  }

  learnSkill(state: AppState, skillId: SkillId): Outcome {
    const skill = SKILLS[skillId];
    if (state.learnedSkills.includes(skillId)) return out(state);
    if (state.stats.lvl < skill.unlockLevel) return out(state, [info("NÍVEL INSUFICIENTE", `${skill.title} exige nível ${skill.unlockLevel}.`)]);
    if (state.stats.gp < skill.price) return out(state, [info("OURO INSUFICIENTE", `${skill.title} custa ${skill.price} de ouro.`)]);
    return this.finish({ ...state, stats: { ...state.stats, gp: state.stats.gp - skill.price }, learnedSkills: [...state.learnedSkills, skillId] }, [
      { kind: "ITEM", title: "HABILIDADE APRENDIDA", body: `${skill.title}\n${skill.description}`, art: skill.art },
    ]);
  }

  /** Changes hair style and color. The first change is free; later ones cost ADJUST_COST gold. */
  adjustAppearance(state: AppState, styleId: string, colorId: string): Outcome {
    if (styleId === state.hairStyle && colorId === state.hairColor) return out(state);
    const cost = state.freeAdjustUsed ? ADJUST_COST : 0;
    if (state.stats.gp < cost) return out(state, [info("OURO INSUFICIENTE", `Cada novo ajuste de aparência custa ${cost} de ouro.`)]);
    const style = HAIR_STYLES.find((s) => s.id === styleId) ?? HAIR_STYLES[0];
    const color = HAIR_COLORS.find((c) => c.id === colorId) ?? HAIR_COLORS[0];
    const note = cost === 0 ? `Ajuste gratuito usado. Os próximos custam ${ADJUST_COST} de ouro.` : `-${cost} de ouro.`;
    return out(
      { ...state, hairStyle: style.id, hairColor: color.id, freeAdjustUsed: true, stats: { ...state.stats, gp: state.stats.gp - cost } },
      [info("APARÊNCIA ATUALIZADA", `${style.label}, cabelo ${color.label.toLowerCase()}.\n${note}`)],
    );
  }

  chooseClass(state: AppState, hunterClass: HunterClass): Outcome {
    if (state.stats.lvl < CLASS_LEVEL) return out(state, [info("CLASSE BLOQUEADA", `Disponível no nível ${CLASS_LEVEL}.`)]);
    if (state.hunterClass === hunterClass) return out(state);
    const changing = state.hunterClass !== null;
    if (changing && state.stats.gp < CLASS_CHANGE_COST) return out(state, [info("OURO INSUFICIENTE", `Trocar de classe custa ${CLASS_CHANGE_COST} de ouro.`)]);
    const c = HUNTER_CLASSES[hunterClass];
    return this.finish({ ...state, hunterClass, stats: changing ? { ...state.stats, gp: state.stats.gp - CLASS_CHANGE_COST } : state.stats }, [
      { kind: "RANK_UP", title: `CLASSE: ${c.label.toUpperCase()}`, body: `${c.description}\n${ATTRIBUTES[c.attribute].short} +${classBonus(state.stats.lvl)}` },
    ]);
  }

  private complete(state: AppState, task: Task): Outcome {
    if (state.dead) return out(state);
    const messages: SystemMessage[] = [];
    const d = delta(task, "UP");
    const [rewarded, record] = this.gain(state, task, d, messages);
    const streak = task.type === "DAILY" ? task.streak + 1 : task.streak;
    let next = replace(rewarded, { ...task, completed: true, value: task.value + d, streak, lastScore: { ...record, valueDelta: d } });
    next = { ...next, counters: { ...next.counters, maxStreak: Math.max(next.counters.maxStreak, streak) } };
    return this.finish(next, messages);
  }

  /** Unchecking takes back exactly what completing granted, without lowering the level. */
  private undo(state: AppState, task: Task): Outcome {
    const record = task.lastScore ?? emptyRecord();
    const stats = { ...state.stats, exp: Math.max(0, state.stats.exp - record.exp), gp: Math.max(0, state.stats.gp - record.gp) };
    const updated: Task = {
      ...task,
      completed: false,
      value: task.value - record.valueDelta,
      streak: task.type === "DAILY" ? Math.max(0, task.streak - 1) : task.streak,
      lastScore: null,
    };
    const counters = { ...state.counters, totalCompleted: Math.max(0, state.counters.totalCompleted - 1) };
    let gate = state.gate;
    // Only the enemy that took the hit heals; enemies already defeated stay defeated.
    if (gate && gate.gateId === record.gateId && gate.stage === record.stage) {
      const g = gateById(gate.gateId);
      if (g) gate = { ...gate, enemyHp: Math.min(enemyOf(gate, g).hp, currentHp(gate, g) + record.bossDamage) };
    }
    return out(replace({ ...state, stats, counters, gate }, updated));
  }

  private gain(state: AppState, task: Task, d: number, messages: SystemMessage[]): [AppState, ScoreRecord] {
    const attrs = effective(state);
    let exp = expGain(d, priorityOf(task), attrs);
    let gp = goldGain(d, task, attrs);
    let boss = bossDamage(d, priorityOf(task), attrs.str);
    if (this.random() < critChance(attrs.str)) {
      exp = Math.round(exp * CRIT_MULTIPLIER);
      gp *= CRIT_MULTIPLIER;
      boss = Math.round(boss * CRIT_MULTIPLIER * 10) / 10;
      messages.push({ kind: "CRITICAL", title: "GOLPE CRÍTICO", body: `Recompensa multiplicada por ${CRIT_MULTIPLIER}.` });
    }
    const stats = state.stats;
    const mp = maxMp(state);
    let next: AppState = {
      ...state,
      stats: { ...stats, exp: stats.exp + exp, gp: stats.gp + gp, mp: Math.min(mp, stats.mp + 1) },
      counters: { ...state.counters, totalCompleted: state.counters.totalCompleted + 1 },
    };
    let record: ScoreRecord = { ...emptyRecord(), exp, gp };
    const run = state.gate;
    const gate = gateById(run?.gateId);
    if (run && gate) {
      const [after, dealt] = this.strike(run, gate, boss, messages);
      if (!after) next = this.clearGate(next, gate, messages);
      else {
        next = { ...next, gate: after };
        record = { ...record, bossDamage: dealt, gateId: gate.id, stage: after.stage };
      }
    }
    next = { ...next, stats: this.levelUp(next.stats, messages) };
    return [next, record];
  }

  /**
   * Applies [damage] to the current enemy, carrying overflow into the next ones. Returns the new run,
   * or null when the boss falls, plus the damage taken by the enemy left standing.
   */
  private strike(run: GateRun, gate: Gate, damage: number, messages: SystemMessage[]): [GateRun | null, number] {
    const stages = stagesOf(gate);
    let stage = Math.min(Math.max(run.stage, 0), stages.length - 1);
    let hp = currentHp(run, gate);
    let left = damage;
    let dealt = 0;
    const log = [...run.log];
    while (left > 0) {
      const enemy = stages[stage];
      const taken = Math.min(left, hp);
      hp -= taken;
      left -= taken;
      dealt += taken;
      log.push(`Você causou ${fmt1(taken)} de dano em ${enemy.name}.`);
      if (hp > 1e-6) break;
      log.push(`${enemy.name} foi derrotado.`);
      stage++;
      if (stage > stages.length - 1) return [null, 0];
      hp = stages[stage].hp;
      dealt = 0;
      if (stage === stages.length - 1) {
        messages.push({ kind: "BOSS", title: "O CHEFE APARECEU", body: `${gate.boss.name} surgiu das profundezas do portal.`, art: gate.boss.art });
      }
    }
    return [{ ...run, stage, enemyHp: hp, log: log.slice(-LOG_SIZE), strikes: run.strikes + 1, hits: [...run.hits, damage].slice(-LOG_SIZE) }, dealt];
  }

  private clearGate(state: AppState, gate: Gate, messages: SystemMessage[]): AppState {
    const firstClear = !state.clearedGates.includes(gate.id);
    messages.push({ kind: "GATE_CLEAR", title: "PORTAL FECHADO", body: `${gate.boss.name} foi derrotado.\n+${gate.exp} XP  ·  +${gate.gold} ouro`, art: gate.boss.art });
    let shadows = state.shadows;
    if (firstClear) {
      messages.push({
        kind: "ARISE",
        title: "LEVANTE-SE",
        body: `${gate.shadowName} se juntou ao seu exército.\n${ATTRIBUTES[gate.shadowAttribute].short} +${gate.shadowBonus} permanente`,
        art: gate.boss.art,
      });
      shadows = [...shadows, { id: newId(), name: gate.shadowName, attribute: gate.shadowAttribute, bonus: gate.shadowBonus, gateId: gate.id }];
    }
    return {
      ...state,
      gate: null,
      clearedGates: state.clearedGates.includes(gate.id) ? state.clearedGates : [...state.clearedGates, gate.id],
      shadows,
      stats: { ...state.stats, exp: state.stats.exp + gate.exp, gp: state.stats.gp + gate.gold },
    };
  }

  private damage(state: AppState, task: Task, d: number, messages: SystemMessage[]): AppState {
    return this.applyHp(state, hpLoss(d, priorityOf(task), effective(state)), messages);
  }

  private applyHp(state: AppState, change: number, messages: SystemMessage[]): AppState {
    const hp = state.stats.hp + change;
    if (hp > 0) return { ...state, stats: { ...state.stats, hp } };
    messages.push({ kind: "DEATH", title: "VOCÊ MORREU", body: "Seu HP chegou a zero. Penalidade: perda de 1 nível, de todo o ouro e do XP atual." });
    return { ...state, stats: { ...state.stats, hp: 0 }, dead: true };
  }

  /** Observed: leveling up subtracts the threshold and restores HP to 50. */
  private levelUp(stats: Stats, messages: SystemMessage[]): Stats {
    let s = stats;
    while (s.exp >= toNextLevel(s.lvl)) {
      const oldRank = rankFor(s.lvl);
      s = { ...s, exp: s.exp - toNextLevel(s.lvl), lvl: s.lvl + 1, hp: MAX_HP, points: s.points + 1 };
      messages.push({ kind: "LEVEL_UP", title: "NÍVEL AUMENTOU!", body: `Você alcançou o nível ${s.lvl}.\nHP restaurado. +1 ponto de atributo.`, art: "hero" });
      const newRank = rankFor(s.lvl);
      if (newRank !== oldRank) messages.push({ kind: "RANK_UP", title: "RANK ATUALIZADO", body: `Você agora é um ${rankTitle(newRank)}.` });
    }
    return s;
  }

  private spend(state: AppState, cost: number, success: string, effect: (s: AppState) => AppState): Outcome {
    if (state.stats.gp < cost) return out(state, [info("OURO INSUFICIENTE", `Você precisa de ${cost} de ouro.`)]);
    const paid: AppState = { ...state, stats: { ...state.stats, gp: state.stats.gp - cost }, counters: { ...state.counters, purchases: state.counters.purchases + 1 } };
    return this.finish(effect(paid), [info("COMPRA CONCLUÍDA", success)]);
  }

  private finish(state: AppState, messages: SystemMessage[]): Outcome {
    const unlocked = ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.unlocked(state));
    if (!unlocked.length) return out(state, messages);
    for (const a of unlocked) messages.push({ kind: "ACHIEVEMENT", title: "CONQUISTA DESBLOQUEADA", body: `${a.title}: ${a.description}` });
    return out({ ...state, achievements: [...state.achievements, ...unlocked.map((a) => a.id)] }, messages);
  }
}
