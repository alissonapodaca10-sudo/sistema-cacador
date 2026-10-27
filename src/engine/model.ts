// Data model, mirroring the Android app's Models.kt so saves and rules behave the same.

export type TaskType = "HABIT" | "DAILY" | "TODO" | "REWARD";
export type Direction = "UP" | "DOWN";
export type AttributeId = "STR" | "INT" | "CON" | "PER";

export interface DifficultyInfo {
  priority: number;
  rank: string;
  label: string;
}

/** Priority multipliers observed in the original TaskDifficulty enum (0.1 / 1 / 1.5 / 2). */
export const DIFFICULTIES = {
  TRIVIAL: { priority: 0.1, rank: "E", label: "Trivial" },
  EASY: { priority: 1.0, rank: "C", label: "Fácil" },
  MEDIUM: { priority: 1.5, rank: "B", label: "Médio" },
  HARD: { priority: 2.0, rank: "A", label: "Difícil" },
} satisfies Record<string, DifficultyInfo>;
export type Difficulty = keyof typeof DIFFICULTIES;

export const ATTRIBUTES: Record<AttributeId, { short: string; label: string; effect: string }> = {
  STR: { short: "FOR", label: "Força", effect: "Chance de golpe crítico (bônus de XP e ouro)" },
  INT: { short: "INT", label: "Inteligência", effect: "+2,5% de XP por ponto" },
  CON: { short: "VIT", label: "Vitalidade", effect: "Reduz o dano de missões falhadas" },
  PER: { short: "PER", label: "Percepção", effect: "+2% de ouro por ponto" },
};
export const ATTRIBUTE_IDS: AttributeId[] = ["STR", "INT", "CON", "PER"];

export type HunterClass = "FIGHTER" | "MAGE" | "ASSASSIN" | "HEALER";
export const HUNTER_CLASSES: Record<HunterClass, { label: string; attribute: AttributeId; description: string }> = {
  FIGHTER: { label: "Lutador", attribute: "STR", description: "Golpes críticos mais frequentes e mais dano aos chefes." },
  MAGE: { label: "Mago", attribute: "INT", description: "Mais XP por missão concluída." },
  ASSASSIN: { label: "Assassino", attribute: "PER", description: "Mais ouro por missão concluída." },
  HEALER: { label: "Curandeiro", attribute: "CON", description: "Menos dano de missões falhadas." },
};

export interface GateRun {
  gateId: string;
  stage: number;
  enemyHp: number;
  log: string[];
  /** Total attacks made in this gate, so the battle screen can tell which ones it has not shown yet. */
  strikes: number;
  /** Damage of the most recent attacks, oldest first. */
  hits: number[];
}

export interface Shadow {
  id: string;
  name: string;
  attribute: AttributeId;
  bonus: number;
  gateId: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

/** What completing a daily or to-do granted, so unchecking it can take it back. */
export interface ScoreRecord {
  exp: number;
  gp: number;
  valueDelta: number;
  bossDamage: number;
  gateId: string | null;
  stage: number;
}

export interface Task {
  id: string;
  type: TaskType;
  text: string;
  notes: string;
  difficulty: Difficulty;
  value: number;
  up: boolean;
  down: boolean;
  counterUp: number;
  counterDown: number;
  /** ISO days of week, 1 = Monday .. 7 = Sunday. */
  repeatDays: number[];
  streak: number;
  completed: boolean;
  checklist: ChecklistItem[];
  lastScore: ScoreRecord | null;
  /** Epoch day. */
  dueDay: number | null;
  cost: number;
}

export interface Stats {
  hp: number;
  mp: number;
  exp: number;
  gp: number;
  lvl: number;
  str: number;
  int: number;
  con: number;
  per: number;
  points: number;
}

export interface Buffs {
  str: number;
  int: number;
  con: number;
  per: number;
}

export interface Counters {
  totalCompleted: number;
  purchases: number;
  deaths: number;
  maxStreak: number;
  skillsUsed: number;
}

export interface AppState {
  onboarded: boolean;
  hunterName: string;
  stats: Stats;
  buffs: Buffs;
  tasks: Task[];
  counters: Counters;
  achievements: string[];
  lastCronDay: number;
  stealthCharges: number;
  dead: boolean;
  hunterClass: HunterClass | null;
  gate: GateRun | null;
  clearedGates: string[];
  shadows: Shadow[];
  ownedItems: string[];
  weapon: string;
  outfit: string;
  hairColor: string;
  hairStyle: string;
  freeAdjustUsed: boolean;
  learnedSkills: string[];
}

export type MessageKind =
  | "INFO" | "LEVEL_UP" | "RANK_UP" | "PENALTY" | "DEATH" | "ACHIEVEMENT" | "CRITICAL"
  | "GATE_CLEAR" | "ARISE" | "BOSS" | "ITEM";

export interface SystemMessage {
  kind: MessageKind;
  title: string;
  body: string;
  /** Illustration shown by cinematic messages. */
  art?: string;
}

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newTask(partial: Partial<Task> & { type: TaskType }): Task {
  return {
    id: newId(),
    text: "",
    notes: "",
    difficulty: "EASY",
    value: 0,
    up: true,
    down: true,
    counterUp: 0,
    counterDown: 0,
    repeatDays: [...ALL_DAYS],
    streak: 0,
    completed: false,
    checklist: [],
    lastScore: null,
    dueDay: null,
    cost: 10,
    ...partial,
  };
}

export function newChecklistItem(text: string, completed = false): ChecklistItem {
  return { id: newId(), text, completed };
}

export const DEFAULT_STATS: Stats = { hp: 50, mp: 30, exp: 0, gp: 0, lvl: 1, str: 0, int: 0, con: 0, per: 0, points: 0 };

export function initialState(): AppState {
  return {
    onboarded: false,
    hunterName: "",
    stats: { ...DEFAULT_STATS },
    buffs: { str: 0, int: 0, con: 0, per: 0 },
    tasks: [],
    counters: { totalCompleted: 0, purchases: 0, deaths: 0, maxStreak: 0, skillsUsed: 0 },
    achievements: [],
    lastCronDay: 0,
    stealthCharges: 0,
    dead: false,
    hunterClass: null,
    gate: null,
    clearedGates: [],
    shadows: [],
    ownedItems: ["W_RUSTY", "O_SHADOW"],
    weapon: "W_RUSTY",
    outfit: "O_SHADOW",
    hairColor: "BLACK",
    hairStyle: "MESSY",
    freeAdjustUsed: false,
    learnedSkills: ["RECOVERY"],
  };
}

/** Fills fields missing from older saves with their defaults, like Gson does on Android. */
export function migrate(raw: Partial<AppState>): AppState {
  const base = initialState();
  return {
    ...base,
    ...raw,
    stats: { ...base.stats, ...raw.stats },
    buffs: { ...base.buffs, ...raw.buffs },
    counters: { ...base.counters, ...raw.counters },
    tasks: (raw.tasks ?? []).map((t) => newTask({ ...t, type: t.type })),
    gate: raw.gate ? { ...({ strikes: 0, hits: [], log: [], stage: 0, enemyHp: 0 } as Omit<GateRun, "gateId">), ...(raw.gate as Partial<GateRun> & { gateId: string }) } : null,
  };
}
