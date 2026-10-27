import { useState } from "react";
import { rankFor } from "./engine/catalog";
import { newTask, type Task, type TaskType } from "./engine/model";
import { epochDay, MAX_HP, maxMp, toNextLevel } from "./engine/rules";
import { useGame } from "./store";
import { AnimeBackground } from "./ui/Background";
import { MessageView } from "./ui/Cinematic";
import { Btn, C, Dialog, Frame, StatBar } from "./ui/common";
import { ArsenalScreen } from "./ui/screens/ArsenalScreen";
import { GatesScreen } from "./ui/screens/GatesScreen";
import { ShopScreen } from "./ui/screens/ShopScreen";
import { StatusScreen } from "./ui/screens/StatusScreen";
import { TaskEditor } from "./ui/screens/TaskEditor";
import { DailiesScreen, HabitsScreen, TodosScreen } from "./ui/screens/TaskScreens";
import { lookOf } from "./ui/sprites";

type Tab = "STATUS" | "HABITS" | "DAILIES" | "TODOS" | "GATES" | "ARSENAL" | "SHOP";
const TABS: { id: Tab; label: string; icon: string; type: TaskType | null }[] = [
  { id: "STATUS", label: "Status", icon: "👤", type: null },
  { id: "HABITS", label: "Hábitos", icon: "⟳", type: "HABIT" },
  { id: "DAILIES", label: "Diárias", icon: "📅", type: "DAILY" },
  { id: "TODOS", label: "Missões", icon: "☰", type: "TODO" },
  { id: "GATES", label: "Portais", icon: "★", type: null },
  { id: "ARSENAL", label: "Arsenal", icon: "⚔", type: null },
  { id: "SHOP", label: "Loja", icon: "🛒", type: "REWARD" },
];

export function App() {
  const store = useGame();
  const { state, game, apply } = store;
  const [tab, setTab] = useState<Tab>("DAILIES");
  const [editing, setEditing] = useState<Task | null>(null);
  const current = TABS.find((t) => t.id === tab)!;
  const stats = state.stats;

  return (
    <div className="app">
      <AnimeBackground shadowPower={Math.min(state.shadows.length / 6, 1)} />
      {state.onboarded && (
        <div className="hud-wrap">
          <div className="hud">
            <Frame cut={12}>
              <div className="row" style={{ padding: "8px 12px", gap: 10 }}>
                <div className="center" style={{ width: 60 }}>
                  <div className="label">NÍVEL</div>
                  <div className="lvl-num">{stats.lvl}</div>
                  <div className="cond small glow" style={{ color: C.purple }}>RANK {rankFor(stats.lvl).letter}</div>
                </div>
                <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <StatBar compact label="HP" value={stats.hp} max={MAX_HP} color={C.red} />
                  <StatBar compact label="MP" value={stats.mp} max={maxMp(state)} color={C.blue} />
                  <StatBar compact label="XP" value={stats.exp} max={toNextLevel(stats.lvl)} color={C.cyanBright} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="label">OURO</div>
                  <div className="cond glow" style={{ color: C.gold, fontSize: 18 }}>{Math.floor(stats.gp)}</div>
                </div>
              </div>
            </Frame>
          </div>
        </div>
      )}

      <div className="content">
        <div className="column">
          {tab === "STATUS" && <StatusScreen store={store} />}
          {tab === "HABITS" && <HabitsScreen store={store} onEdit={setEditing} />}
          {tab === "DAILIES" && <DailiesScreen store={store} onEdit={setEditing} />}
          {tab === "TODOS" && <TodosScreen store={store} onEdit={setEditing} />}
          {tab === "GATES" && <GatesScreen store={store} />}
          {tab === "ARSENAL" && <ArsenalScreen store={store} />}
          {tab === "SHOP" && <ShopScreen store={store} onEdit={setEditing} />}
        </div>
      </div>

      {current.type && (
        <button className="fab chamfer" aria-label="Adicionar" onClick={() => setEditing(newTask({ type: current.type! }))}>+</button>
      )}

      <nav className="nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            <span className="ico chamfer">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {editing && (
        <TaskEditor
          initial={editing}
          isNew={!state.tasks.some((t) => t.id === editing.id)}
          onSave={(t) => {
            apply((s) => game.upsertTask(s, t));
            setEditing(null);
          }}
          onDelete={() => {
            apply((s) => game.deleteTask(s, editing.id));
            setEditing(null);
          }}
          onDismiss={() => setEditing(null)}
        />
      )}

      {!state.onboarded ? (
        <Onboarding onAccept={(name) => apply((s) => game.onboard(s, name, epochDay()))} />
      ) : store.messages.length ? (
        <MessageView message={store.messages[0]} look={lookOf(state)} onDismiss={store.dismissMessage} />
      ) : state.dead ? (
        <Dialog title="ZONA DE PENALIDADE" accent={C.red} onDismiss={() => {}} dismissible={false}>
          <div className="center">Seu HP chegou a zero.<br /><br />Para retornar, você perderá 1 nível, todo o ouro e o XP atual.</div>
          <div style={{ height: 18 }} />
          <Btn accent={C.red} onClick={() => apply((s) => game.revive(s))}>Aceitar penalidade</Btn>
        </Dialog>
      ) : null}
    </div>
  );
}

function Onboarding({ onAccept }: { onAccept: (name: string) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  return (
    <Dialog title="AVISO" onDismiss={() => {}} dismissible={false}>
      {step === 0 ? (
        <>
          <div className="center">
            Você foi escolhido pelo Sistema.<br /><br />A partir de hoje, seus hábitos, missões diárias e tarefas definirão a sua força.<br /><br />Deseja despertar como Caçador?
          </div>
          <div style={{ height: 18 }} />
          <Btn onClick={() => setStep(1)}>Aceitar</Btn>
        </>
      ) : (
        <>
          <div className="center">Registre o nome do Caçador.</div>
          <div style={{ height: 12 }} />
          <input className="field" placeholder="Nome" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ height: 18 }} />
          <Btn onClick={() => onAccept(name)}>Despertar</Btn>
        </>
      )}
    </Dialog>
  );
}
