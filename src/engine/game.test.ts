// Mirrors the Android app's GameTest so both versions keep the same rules.
import { describe, expect, it } from "vitest";
import { GATES, gateById, ITEMS, itemById } from "./catalog";
import { Game } from "./game";
import { type AppState, initialState, newChecklistItem, newTask, type Stats, type Task } from "./model";
import { delta, effective, levelBonus, MAX_HP, toNextLevel } from "./rules";

const game = new Game(() => 0.999);
const today = 20_388; // 2025-10-28 (a Tuesday)

function stateWith(tasks: Task[] = [], stats: Partial<Stats> = {}): AppState {
  const s = initialState();
  return { ...s, onboarded: true, hunterName: "Teste", stats: { ...s.stats, ...stats }, tasks, lastCronDay: today };
}

const cave = gateById("E_CAVE")!;
const forest = gateById("D_FOREST")!;

describe("scoring", () => {
  it("matches the decompiled delta formula", () => {
    expect(delta(newTask({ type: "HABIT" }), "UP")).toBeCloseTo(1);
    expect(delta(newTask({ type: "HABIT" }), "DOWN")).toBeCloseTo(-1);
    expect(delta(newTask({ type: "HABIT", value: -100 }), "UP")).toBeCloseTo(Math.pow(0.9747, -47.27));
    const todo = newTask({ type: "TODO", checklist: [newChecklistItem("a", true), newChecklistItem("b", true), newChecklistItem("c")] });
    expect(delta(todo, "UP")).toBeCloseTo(3);
  });

  it("grants exp, gold and value for a positive habit", () => {
    const habit = newTask({ id: "h", type: "HABIT", difficulty: "EASY" });
    const s = game.scoreHabit(stateWith([habit]), "h", "UP").state;
    expect(s.stats.exp).toBe(6);
    expect(s.stats.gp).toBeCloseTo(1);
    expect(s.tasks[0].value).toBeCloseTo(1);
  });

  it("scales rewards with INT and PER", () => {
    const habit = newTask({ id: "h", type: "HABIT", difficulty: "HARD" });
    const s = game.scoreHabit(stateWith([habit], { int: 40, per: 50 }), "h", "UP").state;
    expect(s.stats.exp).toBe(24);
    expect(s.stats.gp).toBeCloseTo(4);
  });

  it("reduces damage with CON", () => {
    const habit = newTask({ id: "h", type: "HABIT", difficulty: "EASY" });
    expect(game.scoreHabit(stateWith([habit]), "h", "DOWN").state.stats.hp).toBeCloseTo(48);
    expect(game.scoreHabit(stateWith([habit], { con: 125 }), "h", "DOWN").state.stats.hp).toBeCloseTo(49);
  });

  it("levels up, restoring HP and granting a point", () => {
    const habit = newTask({ id: "h", type: "HABIT" });
    const out = game.scoreHabit(stateWith([habit], { hp: 10, exp: 148 }), "h", "UP");
    expect(toNextLevel(1)).toBe(150);
    expect(out.state.stats.lvl).toBe(2);
    expect(out.state.stats.exp).toBe(4);
    expect(out.state.stats.hp).toBe(MAX_HP);
    expect(out.messages.some((m) => m.kind === "LEVEL_UP")).toBe(true);
  });

  it("takes back a daily's reward when unchecked", () => {
    const daily = newTask({ id: "d", type: "DAILY", difficulty: "MEDIUM" });
    const start = stateWith([daily]);
    const done = game.toggleDaily(start, "d").state;
    expect(done.tasks[0].streak).toBe(1);
    const undone = game.toggleDaily(done, "d").state;
    expect(undone.stats).toEqual(start.stats);
    expect(undone.tasks[0].value).toBeCloseTo(0);
  });
});

describe("daily reset", () => {
  it("damages for missed dailies and resets completed ones", () => {
    const missed = newTask({ id: "m", type: "DAILY", difficulty: "HARD", streak: 5 });
    const done = newTask({ id: "c", type: "DAILY", completed: true, streak: 3 });
    const out = game.cron(stateWith([missed, done]), today + 1);
    expect(out.state.stats.hp).toBeCloseTo(46);
    expect(out.state.tasks.find((t) => t.id === "m")!.streak).toBe(0);
    expect(out.state.tasks.find((t) => t.id === "c")!.completed).toBe(false);
    expect(game.cron(out.state, today + 1).state).toBe(out.state);
  });

  it("scales damage by the unfinished checklist and honors stealth", () => {
    const partial = newTask({ id: "p", type: "DAILY", difficulty: "HARD", checklist: [newChecklistItem("a", true), newChecklistItem("b")] });
    expect(game.cron(stateWith([partial]), today + 1).state.stats.hp).toBeCloseTo(48);
    expect(game.cron({ ...stateWith([partial]), stealthCharges: 2 }, today + 1).state.stats.hp).toBeCloseTo(50);
  });

  it("lets the gate's monsters strike back", () => {
    const missed = newTask({ id: "m", type: "DAILY", difficulty: "HARD" });
    const state = { ...stateWith([missed]), gate: { gateId: "D_FOREST", stage: 1, enemyHp: 10, log: [], strikes: 0, hits: [] } };
    expect(game.cron(state, today + 1).state.stats.hp).toBeCloseTo(42);
  });
});

describe("gates", () => {
  it("strikes waves, carries overflow and announces the boss", () => {
    const habit = newTask({ id: "h", type: "HABIT", difficulty: "HARD" });
    const first = { ...stateWith([habit]), gate: { gateId: "E_CAVE", stage: 0, enemyHp: 2, log: [], strikes: 0, hits: [] } };
    const next = game.scoreHabit(first, "h", "UP").state.gate!;
    expect(next.stage).toBe(1);
    expect(next.enemyHp).toBeCloseTo(4);
    expect(next.strikes).toBe(1);

    const lastMob = { ...stateWith([habit]), gate: { gateId: "E_CAVE", stage: 2, enemyHp: 1, log: [], strikes: 0, hits: [] } };
    const out = game.scoreHabit(lastMob, "h", "UP");
    expect(out.state.gate!.stage).toBe(3);
    expect(out.state.gate!.enemyHp).toBeCloseTo(cave.boss.hp - 5);
    expect(out.messages.some((m) => m.kind === "BOSS")).toBe(true);
  });

  it("grants rewards and extracts a shadow once", () => {
    const habit = newTask({ id: "h", type: "HABIT", difficulty: "HARD" });
    const almost = { ...stateWith([habit]), gate: { gateId: "E_CAVE", stage: 3, enemyHp: 2, log: [], strikes: 0, hits: [] } };
    const out = game.scoreHabit(almost, "h", "UP");
    expect(out.state.gate).toBeNull();
    expect(out.state.shadows.map((s) => s.name)).toEqual([cave.shadowName]);
    expect(out.state.stats.exp).toBe(12 + cave.exp);
    expect(effective(out.state).per).toBe(cave.shadowBonus);
    const again = game.scoreHabit({ ...out.state, gate: { gateId: "E_CAVE", stage: 3, enemyHp: 1, log: [], strikes: 0, hits: [] } }, "h", "UP");
    expect(again.state.shadows).toHaveLength(1);
  });

  it("requires the level and one gate at a time", () => {
    expect(game.startGate(stateWith(), forest).state.gate).toBeNull();
    expect(GATES).toHaveLength(6);
  });
});

describe("arsenal", () => {
  it("buys, equips and adds weapon bonuses", () => {
    const hunter = itemById("W_HUNTER")!;
    const low = stateWith([], { lvl: 2, gp: 100 });
    expect(game.buyItem(low, hunter).state).toBe(low);
    const ready = stateWith([], { lvl: 3, gp: 50 });
    const purchase = game.buyItem(ready, hunter);
    expect(purchase.messages.find((m) => m.kind === "ITEM")!.art).toBe("item_w_hunter");
    expect(purchase.state.weapon).toBe("W_HUNTER");
    expect(purchase.state.stats.gp).toBe(10);
    expect(effective(purchase.state).str).toBe(effective(ready).str + 2);
  });

  it("needs a cleared gate for trophy weapons", () => {
    const fang = ITEMS.find((i) => i.id === "W_FANG")!;
    const rich = stateWith([], { lvl: 20, gp: 1000 });
    expect(game.buyItem(rich, fang).state.ownedItems).not.toContain("W_FANG");
    expect(game.buyItem({ ...rich, clearedGates: ["D_FOREST"] }, fang).state.weapon).toBe("W_FANG");
  });

  it("makes the first appearance change free", () => {
    const first = game.adjustAppearance(stateWith([], { gp: 40 }), "MESSY", "SILVER").state;
    expect(first.stats.gp).toBe(40);
    const second = game.adjustAppearance(first, "MESSY", "RED").state;
    expect(second.stats.gp).toBe(10);
    expect(game.adjustAppearance(second, "MESSY", "BLUE").state).toBe(second);
  });

  it("requires learning skills before use", () => {
    const state = stateWith([], { lvl: 3, gp: 100, mp: 30 });
    expect(game.useSkill(state, "FOCUS").state).toBe(state);
    const learned = game.learnSkill(state, "FOCUS").state;
    expect(learned.stats.gp).toBe(40);
    expect(game.useSkill(learned, "FOCUS").state.buffs.int).toBeGreaterThan(0);
  });

  it("caps the level bonus", () => {
    expect(levelBonus(150)).toBe(50);
  });
});
