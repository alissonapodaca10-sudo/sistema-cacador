import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Game, type Outcome } from "./engine/game";
import { type AppState, type GateRun, initialState, migrate, type SystemMessage } from "./engine/model";
import { epochDay } from "./engine/rules";

const KEY = "sistema-cacador-v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : initialState();
  } catch {
    return initialState();
  }
}

function save(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (private mode): keep playing in memory.
  }
}

export interface GameStore {
  state: AppState;
  messages: SystemMessage[];
  game: Game;
  apply: (action: (s: AppState) => Outcome) => void;
  dismissMessage: () => void;
  /** The gate and HP as last shown in battle, so attacks made on other tabs replay there. */
  seen: { run: GateRun | null; hp: number | null };
}

export function useGame(): GameStore {
  const game = useMemo(() => new Game(), []);
  const stateRef = useRef<AppState>(load());
  const [state, setState] = useState(stateRef.current);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const seen = useRef<{ run: GateRun | null; hp: number | null }>({ run: null, hp: null });

  const apply = useCallback((action: (s: AppState) => Outcome) => {
    const outcome = action(stateRef.current);
    if (outcome.state !== stateRef.current) {
      stateRef.current = outcome.state;
      setState(outcome.state);
      save(outcome.state);
    }
    if (outcome.messages.length) setMessages((m) => [...m, ...outcome.messages]);
  }, []);

  // Daily reset when the app opens, comes back to the foreground, or stays open past midnight.
  useEffect(() => {
    const cron = () => apply((s) => game.cron(s, epochDay()));
    cron();
    const onVisible = () => document.visibilityState === "visible" && cron();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(cron, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [apply, game]);

  const dismissMessage = useCallback(() => setMessages((m) => m.slice(1)), []);
  return { state, messages, game, apply, dismissMessage, seen: seen.current };
}
