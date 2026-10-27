// Formulas, ported from the Android app (Rules.kt and Scoring.kt). The scoring functions are the
// ones observed in the original app's ScoreTaskLocallyInteractor.

import { type Attributes, itemById, plus } from "./catalog";
import { ATTRIBUTE_IDS, type AppState, type Buffs, type Direction, DIFFICULTIES, HUNTER_CLASSES, type Stats, type Task } from "./model";

export const MAX_HP = 50;
export const POTION_COST = 25;
export const POTION_HEAL = 15;
export const CLASS_LEVEL = 10;
export const CLASS_CHANGE_COST = 50;
export const ADJUST_COST = 30;
export const CRIT_MULTIPLIER = 1.5;
export const MIN_TASK_VALUE = -47.27;
export const MAX_TASK_VALUE = 21.27;

/** Experience needed to leave [lvl]. Design choice: the original receives this from the server. */
export const toNextLevel = (lvl: number) => Math.round((lvl * lvl * 0.25 + 10 * lvl + 139.75) / 10) * 10;

/** Observed: every attribute gains min(level / 2, 50). */
export const levelBonus = (lvl: number) => Math.min(Math.floor(lvl / 2), 50);

export const classBonus = (lvl: number) => 5 + Math.floor(lvl / 4);

export function baseEffective(stats: Stats, buffs: Buffs): Attributes {
  const b = levelBonus(stats.lvl);
  return { str: stats.str + buffs.str + b, int: stats.int + buffs.int + b, con: stats.con + buffs.con + b, per: stats.per + buffs.per + b };
}

export function equipmentBonus(state: AppState): Partial<Record<(typeof ATTRIBUTE_IDS)[number], number>> {
  const totals: Partial<Record<(typeof ATTRIBUTE_IDS)[number], number>> = {};
  for (const id of [state.weapon, state.outfit]) {
    const item = itemById(id);
    if (!item) continue;
    for (const a of ATTRIBUTE_IDS) if (item.bonus[a]) totals[a] = (totals[a] ?? 0) + item.bonus[a]!;
  }
  return totals;
}

/** Base, level and skill buffs plus class bonus, extracted shadows and equipment. */
export function effective(state: AppState): Attributes {
  let attrs = baseEffective(state.stats, state.buffs);
  if (state.hunterClass) attrs = plus(attrs, HUNTER_CLASSES[state.hunterClass].attribute, classBonus(state.stats.lvl));
  for (const s of state.shadows) attrs = plus(attrs, s.attribute, s.bonus);
  const eq = equipmentBonus(state);
  for (const a of ATTRIBUTE_IDS) if (eq[a]) attrs = plus(attrs, a, eq[a]!);
  return attrs;
}

export const maxMp = (state: AppState) => 30 + 2 * effective(state).int;

/** Design choice for STR, which the original's local scorer does not use. */
export const critChance = (str: number) => Math.min(0.5, 0.03 + str * 0.005);

/** Design choice: boss damage per completed task, scaled by STR. */
export const bossDamage = (delta: number, priority: number, str: number) => Math.round(delta * priority * 3 * (1 + str * 0.01) * 10) / 10;

export const priorityOf = (task: Task) => DIFFICULTIES[task.difficulty].priority;

/** Red (negative value) tasks are worth more; blue (positive value) tasks are worth less. */
export function delta(task: Task, direction: Direction): number {
  const value = Math.min(Math.max(task.value, MIN_TASK_VALUE), MAX_TASK_VALUE);
  let d = Math.pow(0.9747, value) * (direction === "DOWN" ? -1 : 1);
  if (task.type === "TODO" && task.checklist.length > 0) d *= 1 + task.checklist.filter((c) => c.completed).length;
  return d;
}

export function expGain(d: number, priority: number, attrs: Attributes): number {
  return Math.round((1 + attrs.int * 0.025) * d * priority * 6);
}

export function goldGain(d: number, task: Task, attrs: Attributes): number {
  let gold = d * priorityOf(task) * (1 + attrs.per * 0.02);
  // The decompiled client multiplies by (streak / 100) in integer arithmetic, which is 0 for streaks
  // under 100. The streak bonus is applied as 1 + streak / 100 here.
  if (task.type === "DAILY") gold *= 1 + task.streak / 100;
  return gold;
}

/** Returns a negative HP change for a negative delta. */
export function hpLoss(d: number, priority: number, attrs: Attributes): number {
  const conFactor = Math.max(0.1, 1 - attrs.con / 250);
  return Math.round(d * conFactor * priority * 2 * 10) / 10;
}

export const fmt1 = (v: number) => v.toFixed(1);

// ---- Dates ----

/** Days since 1970-01-01 in local time, like java.time.LocalDate.toEpochDay(). */
export function epochDay(date: Date = new Date()): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** ISO day of week (1 = Monday) of an epoch day. */
export function isoDayOf(day: number): number {
  const d = new Date(day * 86_400_000).getUTCDay();
  return ((d + 6) % 7) + 1;
}

export const isDueOn = (task: Task, day: number) => task.type === "DAILY" && task.repeatDays.includes(isoDayOf(day));

export function formatDay(day: number): string {
  const d = new Date(day * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function dayFromInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000) : null;
}

export function dayToInput(day: number): string {
  const d = new Date(day * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
