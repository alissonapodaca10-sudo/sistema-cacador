import type { CSSProperties, ReactNode } from "react";

export const C = {
  cyan: "#4fc3f7",
  cyanBright: "#a8f0ff",
  blue: "#3d7bff",
  purple: "#9b6bff",
  purpleDeep: "#5b2dbf",
  red: "#ff4d6d",
  orange: "#ff9f43",
  gold: "#ffc857",
  green: "#4dffb4",
  text: "#eaf6ff",
  dim: "#8197b3",
};

const accentStyle = (accent?: string, extra?: CSSProperties) => ({ ...(accent ? { "--accent": accent } : {}), ...extra }) as CSSProperties;

/** Glass panel with a gradient edge, cut corners and a mana glow. */
export function Frame({ accent, glow = true, cut, className = "", style, children, onClick }: {
  accent?: string;
  glow?: boolean;
  cut?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
}) {
  const vars = accentStyle(accent, cut ? ({ "--cut": `${cut}px` } as CSSProperties) : undefined);
  const frame = (
    <div className={`frame chamfer ${className}`} style={{ ...vars, ...style }} onClick={onClick}>
      <div className="frame-inner chamfer">{children}</div>
    </div>
  );
  return glow ? <div className="glow-wrap" style={vars}>{frame}</div> : frame;
}

export function Title({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <div className="title-row" style={accentStyle(accent)}>
      <span className="line l" />
      <span className="t">{children}</span>
      <span className="line r" />
    </div>
  );
}

export function Panel({ title, accent, children, padding = 16 }: { title?: string; accent?: string; children: ReactNode; padding?: number }) {
  return (
    <Frame accent={accent}>
      <div style={{ padding }}>
        {title && <Title accent={accent}>{title}</Title>}
        {children}
      </div>
    </Frame>
  );
}

export function StatBar({ label, value, max, color, compact }: { label: string; value: number; max: number; color: string; compact?: boolean }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div style={{ "--c": color } as CSSProperties}>
      <div className="bar-label">
        <span className="glow" style={{ color }}>{label}</span>
        <span className="dim">{Math.floor(value)} / {Math.floor(max)}</span>
      </div>
      <div className={`bar ${compact ? "compact" : ""}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function Btn({ children, onClick, accent, disabled, style }: { children: ReactNode; onClick?: () => void; accent?: string; disabled?: boolean; style?: CSSProperties }) {
  return (
    <button className="btn" onClick={onClick} disabled={disabled} style={accentStyle(accent, style)}>
      {children}
    </button>
  );
}

export function Chip({ children, on, onClick, accent, style, tight }: { children: ReactNode; on: boolean; onClick: () => void; accent?: string; style?: CSSProperties; tight?: boolean }) {
  return (
    <button className={`chip ${on ? "on" : ""} ${tight ? "tight" : ""}`} onClick={onClick} style={accentStyle(accent, style)}>
      {children}
    </button>
  );
}

export function Check({ on, onClick, accent, small }: { on: boolean; onClick: () => void; accent?: string; small?: boolean }) {
  return (
    <button
      className={`check chamfer ${on ? "on" : ""} ${small ? "small" : ""}`}
      style={accentStyle(accent)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {on ? "✓" : ""}
    </button>
  );
}

/** A System notification window that unfolds open. */
export function Dialog({ title, accent = C.cyan, onDismiss, dismissible = true, children }: {
  title: string;
  accent?: string;
  onDismiss: () => void;
  dismissible?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="overlay" onClick={() => dismissible && onDismiss()}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={accentStyle(accent)}>
        <Frame accent={accent}>
          <div className="dialog-head">
            <span className="bang">!</span>
            <span className="cond glow" style={{ color: accent, fontSize: 17 }}>{title}</span>
          </div>
          <div className="dialog-sep" />
          {children}
        </Frame>
      </div>
    </div>
  );
}
