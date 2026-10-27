// Rules tables: ranks, skills, achievements, gates, items and appearance options.

import { ATTRIBUTE_IDS, type AppState, type AttributeId, type GateRun, newChecklistItem, newTask, type Task } from "./model";

export interface Attributes {
  str: number;
  int: number;
  con: number;
  per: number;
}

export const attrKey: Record<AttributeId, keyof Attributes> = { STR: "str", INT: "int", CON: "con", PER: "per" };

export function plus(a: Attributes, attribute: AttributeId, amount: number): Attributes {
  const k = attrKey[attribute];
  return { ...a, [k]: a[k] + amount };
}

export const RANKS = [
  { letter: "E", minLevel: 1 },
  { letter: "D", minLevel: 10 },
  { letter: "C", minLevel: 20 },
  { letter: "B", minLevel: 30 },
  { letter: "A", minLevel: 45 },
  { letter: "S", minLevel: 60 },
] as const;
export type Rank = (typeof RANKS)[number];

export function rankFor(lvl: number): Rank {
  return [...RANKS].reverse().find((r) => lvl >= r.minLevel) ?? RANKS[0];
}

export const rankTitle = (r: Rank) => `Caçador Rank ${r.letter}`;

export type SkillId = "RECOVERY" | "FOCUS" | "HUNTER_INSTINCT" | "STEALTH";

/** Skills are learned in the shop once the level allows; price is in gold. */
export const SKILLS: Record<SkillId, { title: string; description: string; mpCost: number; unlockLevel: number; price: number; art: string }> = {
  RECOVERY: { title: "Recuperação", description: "Restaura 15 HP.", mpCost: 15, unlockLevel: 1, price: 0, art: "skill_recovery" },
  FOCUS: { title: "Concentração", description: "Aumenta INT até a virada do dia: mais XP por missão.", mpCost: 20, unlockLevel: 3, price: 60, art: "skill_focus" },
  HUNTER_INSTINCT: {
    title: "Instinto de Caça",
    description: "Aumenta PER até a virada do dia: mais ouro por missão.",
    mpCost: 20,
    unlockLevel: 5,
    price: 100,
    art: "skill_hunter_instinct",
  },
  STEALTH: {
    title: "Furtividade",
    description: "Evita o dano de até 2 missões diárias não cumpridas na próxima virada.",
    mpCost: 30,
    unlockLevel: 10,
    price: 250,
    art: "skill_stealth",
  },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const buffAmount = (lvl: number) => 5 + Math.floor(lvl / 2);

export interface Enemy {
  name: string;
  hp: number;
  art: string;
}

export interface Gate {
  id: string;
  rank: string;
  title: string;
  scene: string;
  minLevel: number;
  mobs: Enemy[];
  boss: Enemy;
  bossStrength: number;
  exp: number;
  gold: number;
  shadowName: string;
  shadowAttribute: AttributeId;
  shadowBonus: number;
}

const wave = (count: number, enemy: Enemy) => Array.from({ length: count }, () => enemy);

/**
 * Dungeons: waves of monsters, then the boss. Completed tasks strike the current enemy;
 * missed dailies let the gate's monsters strike back at the daily reset.
 */
export const GATES: Gate[] = [
  {
    id: "E_CAVE", rank: "E", title: "Caverna Úmida", scene: "scene_cave", minLevel: 1,
    mobs: wave(3, { name: "Goblin", hp: 8, art: "enemy_goblin" }), boss: { name: "Goblin Xamã", hp: 25, art: "boss_goblin" },
    bossStrength: 0.5, exp: 50, gold: 25, shadowName: "Sombra Goblin", shadowAttribute: "PER", shadowBonus: 1,
  },
  {
    id: "D_FOREST", rank: "D", title: "Floresta Uivante", scene: "scene_forest", minLevel: 5,
    mobs: wave(3, { name: "Lobo Sombrio", hp: 25, art: "enemy_wolf" }), boss: { name: "Lobo Alfa Sombrio", hp: 90, art: "boss_wolf" },
    bossStrength: 1.0, exp: 150, gold: 60, shadowName: "Sombra Lupina", shadowAttribute: "STR", shadowBonus: 2,
  },
  {
    id: "C_RUINS", rank: "C", title: "Ruínas de Pedra", scene: "scene_ruins", minLevel: 15,
    mobs: wave(3, { name: "Diabrete de Pedra", hp: 60, art: "enemy_imp" }), boss: { name: "Golem Ancestral", hp: 200, art: "boss_golem" },
    bossStrength: 1.5, exp: 400, gold: 150, shadowName: "Sombra Golem", shadowAttribute: "CON", shadowBonus: 3,
  },
  {
    id: "B_NEST", rank: "B", title: "Ninho Profundo", scene: "scene_nest", minLevel: 25,
    mobs: wave(4, { name: "Aranha Venenosa", hp: 90, art: "enemy_spider" }), boss: { name: "Rainha Aracnídea", hp: 400, art: "boss_spider" },
    bossStrength: 2.0, exp: 800, gold: 300, shadowName: "Sombra Aracnídea", shadowAttribute: "PER", shadowBonus: 4,
  },
  {
    id: "A_CASTLE", rank: "A", title: "Castelo Amaldiçoado", scene: "scene_castle", minLevel: 40,
    mobs: wave(4, { name: "Soldado Esqueleto", hp: 150, art: "enemy_skeleton" }), boss: { name: "Cavaleiro Sem Rosto", hp: 700, art: "boss_knight" },
    bossStrength: 2.5, exp: 1500, gold: 600, shadowName: "Sombra Cavaleiro", shadowAttribute: "STR", shadowBonus: 6,
  },
  {
    id: "S_SKY", rank: "S", title: "Céu em Chamas", scene: "scene_sky", minLevel: 55,
    mobs: wave(4, { name: "Serpe Flamejante", hp: 250, art: "enemy_wyvern" }), boss: { name: "Dragão Primordial", hp: 1500, art: "boss_dragon" },
    bossStrength: 3.0, exp: 3000, gold: 1200, shadowName: "Sombra Dragão", shadowAttribute: "INT", shadowBonus: 10,
  },
];

export const gateById = (id: string | null | undefined) => GATES.find((g) => g.id === id);
export const stagesOf = (gate: Gate) => [...gate.mobs, gate.boss];

/** The enemy being fought, clamped so a stale save cannot index past the boss. */
export function enemyOf(run: GateRun, gate: Gate): Enemy {
  const stages = stagesOf(gate);
  return stages[Math.min(Math.max(run.stage, 0), stages.length - 1)];
}

/** Saves without enemy health start the current enemy at full health. */
export function currentHp(run: GateRun, gate: Gate): number {
  return run.enemyHp > 0 ? run.enemyHp : enemyOf(run, gate).hp;
}

export type Slot = "WEAPON" | "OUTFIT";

export const RARITIES = {
  COMMON: { label: "Comum", color: "#9AA3AF", order: 0 },
  UNCOMMON: { label: "Incomum", color: "#4DFFB4", order: 1 },
  RARE: { label: "Raro", color: "#3D7BFF", order: 2 },
  EPIC: { label: "Épico", color: "#9B6BFF", order: 3 },
  LEGENDARY: { label: "Lendário", color: "#FFC857", order: 4 },
  MYTHIC: { label: "Mítico", color: "#FF4D6D", order: 5 },
};
export type Rarity = keyof typeof RARITIES;

export interface Item {
  id: string;
  slot: Slot;
  title: string;
  rarity: Rarity;
  minLevel: number;
  price: number;
  bonus: Partial<Record<AttributeId, number>>;
  flavor: string;
  /** Tints the hunter's clothing for outfits; null keeps the original art. */
  color: string | null;
  requiresGate: string | null;
}

const weapon = (id: string, title: string, rarity: Rarity, minLevel: number, price: number, bonus: Item["bonus"], flavor: string, requiresGate: string | null = null): Item =>
  ({ id, slot: "WEAPON", title, rarity, minLevel, price, bonus, flavor, color: null, requiresGate });
const outfit = (id: string, title: string, rarity: Rarity, minLevel: number, price: number, bonus: Item["bonus"], flavor: string, color: string | null): Item =>
  ({ id, slot: "OUTFIT", title, rarity, minLevel, price, bonus, flavor, color, requiresGate: null });

/**
 * Equipment. Prices follow the game's economy: early tasks earn about 1-2 gold each and gates pay
 * 25-1200, so each tier costs roughly a few days of play at the level it unlocks.
 */
export const ITEMS: Item[] = [
  weapon("W_RUSTY", "Adaga Enferrujada", "COMMON", 1, 0, {}, "A lâmina de todo Caçador que acabou de despertar. Lascada, mas fiel."),
  weapon("W_HUNTER", "Adaga de Caçador", "UNCOMMON", 3, 40, { STR: 2 }, "Aço da Associação, com uma canaleta que conduz mana."),
  weapon("W_MANA", "Lâmina de Mana", "RARE", 8, 120, { STR: 2, INT: 3 }, "Cristal lapidado de um núcleo de mana. Brilha mais quando a mente está focada."),
  weapon("W_ASSASSIN", "Adaga do Assassino", "RARE", 15, 300, { STR: 3, PER: 5 }, "Curva e silenciosa. O fio esverdeado encontra os pontos fracos."),
  weapon("W_FANG", "Presa do Lobo Alfa", "EPIC", 20, 550, { STR: 8 }, "Talhada da presa do Lobo Alfa Sombrio. Ainda exala o frio da floresta.", "D_FOREST"),
  weapon("W_VENOM", "Ferrão da Rainha", "EPIC", 28, 900, { STR: 6, PER: 6 }, "O ferrão da Rainha Aracnídea. O veneno nunca seca.", "B_NEST"),
  weapon("W_SHADOW", "Adaga Sombria", "LEGENDARY", 38, 1500, { STR: 12, PER: 6 }, "Forjada em sombra condensada. Some na escuridão junto com seu dono."),
  weapon("W_ABYSS", "Lâmina do Abismo", "MYTHIC", 52, 3200, { STR: 20, INT: 10 }, "Runas incandescentes queimam no metal negro. Dizem que veio do fundo do último portal.", "A_CASTLE"),
  outfit("O_SHADOW", "Casaco Sombrio", "COMMON", 1, 0, {}, "O casaco longo de sempre. Leve e discreto.", null),
  outfit("O_LEATHER", "Couro Reforçado", "UNCOMMON", 3, 50, { CON: 2 }, "Couro curtido com placas costuradas por dentro.", "#8A5A3A"),
  outfit("O_AZURE", "Manto Azul do Caçador", "RARE", 10, 220, { CON: 4, INT: 2 }, "Tecido encantado que dispersa parte da mana inimiga.", "#2F5BD8"),
  outfit("O_CRIMSON", "Armadura Carmesim", "EPIC", 20, 650, { CON: 8, STR: 3 }, "Tingida com o sangue dos chefes derrotados. Intimida quem vê.", "#B3202E"),
  outfit("O_ROYAL", "Traje Real", "LEGENDARY", 35, 1600, { CON: 12, PER: 5 }, "Usado pelos Caçadores de Rank S nas cerimônias da Associação.", "#E8E2D0"),
  outfit("O_ABYSS", "Manto do Abismo", "MYTHIC", 50, 3600, { STR: 8, INT: 8, CON: 8, PER: 8 }, "Tecido com a própria escuridão. Fortalece cada parte do Caçador.", "#5B2DBF"),
];

export const itemById = (id: string | null | undefined) => ITEMS.find((i) => i.id === id);
export const STARTER_ITEMS = ["W_RUSTY", "O_SHADOW"];

/** The card illustration: weapons have their own art; outfits show the hunter wearing them. */
export const itemArt = (item: Item) => (item.slot === "WEAPON" ? `item_${item.id.toLowerCase()}` : "hero");

export function bonusText(item: Item): string {
  const entries = ATTRIBUTE_IDS.filter((a) => item.bonus[a]).map((a) => [a, item.bonus[a]!] as const);
  if (entries.length === 0) return "Sem bônus";
  if (entries.length === 4 && new Set(entries.map(([, v]) => v)).size === 1) return `TODOS +${entries[0][1]}`;
  const short: Record<AttributeId, string> = { STR: "FOR", INT: "INT", CON: "VIT", PER: "PER" };
  return entries.map(([a, v]) => `${short[a]} +${v}`).join("  ");
}

/** Hair colors; null keeps the original black hair. */
export const HAIR_COLORS = [
  { id: "BLACK", label: "Preto", color: null },
  { id: "SILVER", label: "Prateado", color: "#D8DEE9" },
  { id: "BLUE", label: "Azul", color: "#3D7BFF" },
  { id: "PURPLE", label: "Roxo", color: "#8A5CFF" },
  { id: "RED", label: "Vermelho", color: "#C62828" },
  { id: "BLOND", label: "Loiro", color: "#FFC857" },
  { id: "BROWN", label: "Castanho", color: "#7A4A2A" },
  { id: "GREEN", label: "Verde", color: "#2EBD7A" },
] as const;

/** Hair styles: each style is a separate illustration of the hunter. */
export const HAIR_STYLES = [{ id: "MESSY", label: "Bagunçado", art: "hero" }] as const;

export const ACHIEVEMENTS: { id: string; title: string; description: string; unlocked: (s: AppState) => boolean }[] = [
  { id: "AWAKENING", title: "Despertar", description: "Conclua sua primeira missão.", unlocked: (s) => s.counters.totalCompleted >= 1 },
  { id: "DISCIPLINE", title: "Disciplina", description: "Mantenha uma sequência de 7 dias em uma missão diária.", unlocked: (s) => s.counters.maxStreak >= 7 },
  { id: "IRON_WILL", title: "Vontade de Ferro", description: "Mantenha uma sequência de 21 dias em uma missão diária.", unlocked: (s) => s.counters.maxStreak >= 21 },
  { id: "HUNDRED", title: "Cem Batalhas", description: "Conclua 100 missões.", unlocked: (s) => s.counters.totalCompleted >= 100 },
  { id: "RANK_D", title: "Ascensão", description: "Alcance o Rank D (nível 10).", unlocked: (s) => s.stats.lvl >= 10 },
  { id: "RANK_B", title: "Elite", description: "Alcance o Rank B (nível 30).", unlocked: (s) => s.stats.lvl >= 30 },
  { id: "RANK_S", title: "Monarca", description: "Alcance o Rank S (nível 60).", unlocked: (s) => s.stats.lvl >= 60 },
  { id: "SURVIVOR", title: "Sobrevivente", description: "Volte da Zona de Penalidade.", unlocked: (s) => s.counters.deaths >= 1 },
  { id: "MERCHANT", title: "Cliente do Sistema", description: "Compre um item na loja.", unlocked: (s) => s.counters.purchases >= 1 },
  { id: "CASTER", title: "Primeira Habilidade", description: "Use uma habilidade.", unlocked: (s) => s.counters.skillsUsed >= 1 },
  { id: "CLASS", title: "Despertar de Classe", description: "Escolha uma classe de Caçador.", unlocked: (s) => s.hunterClass !== null },
  { id: "FIRST_GATE", title: "Portal Fechado", description: "Derrote o chefe de um portal.", unlocked: (s) => s.clearedGates.length > 0 },
  { id: "ARMY", title: "Exército das Sombras", description: "Extraia 3 sombras.", unlocked: (s) => s.shadows.length >= 3 },
  { id: "ARMED", title: "Bem Equipado", description: "Compre uma arma ou traje na loja.", unlocked: (s) => s.ownedItems.length > STARTER_ITEMS.length },
];

export function starterTasks(): Task[] {
  return [
    newTask({
      type: "DAILY",
      text: "Treino diário",
      notes: "Preparação para se tornar mais forte.",
      difficulty: "HARD",
      checklist: ["100 flexões", "100 abdominais", "100 agachamentos", "Corrida de 10 km"].map((t) => newChecklistItem(t)),
    }),
    newTask({ type: "DAILY", text: "Ler por 20 minutos", difficulty: "EASY" }),
    newTask({ type: "HABIT", text: "Beber água", difficulty: "TRIVIAL", down: false }),
    newTask({ type: "HABIT", text: "Procrastinar no celular", difficulty: "EASY", up: false }),
    newTask({ type: "TODO", text: "Organizar o quarto", difficulty: "MEDIUM" }),
    newTask({ type: "REWARD", text: "1 episódio de série", cost: 20 }),
    newTask({ type: "REWARD", text: "Lanche favorito", cost: 40 }),
  ];
}
