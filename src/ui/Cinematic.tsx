import type { CSSProperties } from "react";
import type { MessageKind, SystemMessage } from "../engine/model";
import { Btn, C, Dialog } from "./common";
import { HeroPortrait, type Look, ShadowFigure, Sprite } from "./sprites";

const CINEMATIC: MessageKind[] = ["LEVEL_UP", "RANK_UP", "GATE_CLEAR", "ARISE", "BOSS", "ITEM"];

export function accentFor(kind: MessageKind): string {
  switch (kind) {
    case "PENALTY":
    case "DEATH":
    case "BOSS":
      return C.red;
    case "LEVEL_UP":
    case "CRITICAL":
    case "GATE_CLEAR":
      return C.cyanBright;
    case "RANK_UP":
    case "ACHIEVEMENT":
    case "ARISE":
      return C.purple;
    case "ITEM":
      return C.gold;
    default:
      return C.cyan;
  }
}

/** Full-screen scene for level ups, bosses, cleared gates, shadow extraction and new items. */
function Cinematic({ message, look, onDismiss }: { message: SystemMessage; look: Look; onDismiss: () => void }) {
  const accent = accentFor(message.kind);
  const shadow = message.kind === "ARISE";
  const figure: CSSProperties = { width: 220, height: 300, position: "relative" };
  return (
    <div className="cine" style={{ "--accent": accent } as CSSProperties} onClick={onDismiss}>
      <div className="cine-glow" />
      <div className="cine-ring" />
      <div className="cine-ring" />
      <div className="cine-ring" />
      {shadow && <div className="smoke" />}
      <div className="cine-content">
        {shadow && message.art && <ShadowFigure art={message.art} style={figure} />}
        {!shadow && message.art === "hero" && <HeroPortrait look={look} aura={accent} style={figure} />}
        {!shadow && message.art && message.art !== "hero" && <Sprite art={message.art} center style={figure} />}
        <div className="cine-title">{message.title}</div>
        <div className="cine-body">{message.body}</div>
        <div className="label" style={{ marginTop: 24 }}>TOQUE PARA CONTINUAR</div>
      </div>
    </div>
  );
}

export function MessageView({ message, look, onDismiss }: { message: SystemMessage; look: Look; onDismiss: () => void }) {
  if (CINEMATIC.includes(message.kind)) return <Cinematic message={message} look={look} onDismiss={onDismiss} />;
  const accent = accentFor(message.kind);
  return (
    <Dialog title={message.title} accent={accent} onDismiss={onDismiss}>
      <div className="center" style={{ whiteSpace: "pre-line", fontSize: 16 }}>{message.body}</div>
      <div style={{ height: 18 }} />
      <Btn accent={accent} onClick={onDismiss}>Confirmar</Btn>
    </Dialog>
  );
}
