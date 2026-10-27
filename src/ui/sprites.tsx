import { forwardRef, type CSSProperties } from "react";
import { HAIR_COLORS, HAIR_STYLES, itemById } from "../engine/catalog";
import type { AppState } from "../engine/model";

/** Art files live in public/art; scenes are JPEG, everything else WebP. */
export const artUrl = (key: string) => `${import.meta.env.BASE_URL}art/${key}.${key.startsWith("scene_") ? "jpg" : "webp"}`;

export interface Look {
  art: string;
  hair: string | null;
  outfit: string | null;
}

export function lookOf(state: AppState): Look {
  const style = HAIR_STYLES.find((s) => s.id === state.hairStyle) ?? HAIR_STYLES[0];
  return {
    art: style.art,
    hair: HAIR_COLORS.find((c) => c.id === state.hairColor)?.color ?? null,
    outfit: itemById(state.outfit)?.color ?? null,
  };
}

const maskStyle = (url: string): CSSProperties => ({ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` });

/**
 * A cut-out character standing on the bottom edge of its box. The flash element tints only the
 * character's own pixels; the battle animates its opacity through the forwarded ref.
 */
export const Sprite = forwardRef<HTMLDivElement, { art: string; className?: string; style?: CSSProperties; flash?: string; center?: boolean }>(
  function Sprite({ art, className = "", style, flash, center }, flashRef) {
    const url = artUrl(art);
    return (
      <div className={`sprite ${center ? "center" : ""} ${className}`} style={style}>
        <img src={url} alt="" draggable={false} />
        {flash && <div ref={flashRef} className="flash" style={{ ...maskStyle(url), background: flash, WebkitMaskPosition: center ? "center" : undefined }} />}
      </div>
    );
  },
);

/** The hunter with the chosen hair and outfit colors multiplied over the art's shading layers. */
export const HeroSprite = forwardRef<HTMLDivElement, { look: Look; className?: string; style?: CSSProperties; flash?: string }>(
  function HeroSprite({ look, className = "", style, flash }, flashRef) {
    const base = artUrl(look.art);
    const layer = (key: string, color: string) => {
      const url = artUrl(key);
      return <div className="layer" style={{ ...maskStyle(url), backgroundImage: `url(${url})`, backgroundColor: color }} />;
    };
    return (
      <div className={`sprite ${className}`} style={style}>
        <img src={base} alt="Caçador" draggable={false} />
        {look.outfit && layer(`${look.art}_outfit`, look.outfit)}
        {look.hair && layer(`${look.art}_hair`, look.hair)}
        {flash && <div ref={flashRef} className="flash" style={{ ...maskStyle(base), background: flash }} />}
      </div>
    );
  },
);

/** An unrevealed character: pitch dark with a gray rim. */
export function Silhouette({ art, style }: { art: string; style?: CSSProperties }) {
  return <Sprite art={art} className="silhouette" style={style} />;
}

/** A defeated boss raised as a shadow soldier. */
export function ShadowFigure({ art, style }: { art: string; style?: CSSProperties }) {
  return <Sprite art={art} className="shadow-tint" style={style} />;
}

/** The hunter standing in an aura, breathing. */
export function HeroPortrait({ look, aura, style }: { look: Look; aura: string; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative", flex: "none", ...style }}>
      <div className="aura" style={{ "--aura": aura } as CSSProperties} />
      <div className="ground" style={{ "--aura": aura } as CSSProperties} />
      <HeroSprite look={look} className="breathe" style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
