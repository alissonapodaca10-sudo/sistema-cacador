import { useEffect, useRef } from "react";

interface Mote {
  x: number;
  y: number;
  speed: number;
  size: number;
  seed: number;
  purple: boolean;
}

/** Night sky with drifting mana and shadow auras, light slashes and rising mana motes. */
export function AnimeBackground({ shadowPower = 0 }: { shadowPower?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const power = useRef(shadowPower);
  power.current = shadowPower;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const motes: Mote[] = Array.from({ length: 48 }, () => ({ x: rand(), y: rand(), speed: 0.3 + rand() * 0.7, size: 1 + rand() * 2.2, seed: rand(), purple: rand() < 0.35 }));
    let frame = 0;
    const start = performance.now();

    const aura = (color: string, x: number, y: number, r: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const phase = ((now - start) / 24000) % 1;
      const a = phase * Math.PI * 2;
      const sp = power.current;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#02030a");
      bg.addColorStop(0.5, "#050b1f");
      bg.addColorStop(1, "#0b0520");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      aura("rgba(61,123,255,0.30)", w * (0.2 + 0.12 * Math.sin(a)), h * (0.15 + 0.04 * Math.cos(a)), w * 0.95);
      aura("rgba(79,195,247,0.10)", w * (0.85 + 0.08 * Math.cos(a * 2)), h * 0.35, w * 0.6);
      aura(`rgba(155,107,255,${0.22 + 0.15 * sp})`, w * (0.75 + 0.1 * Math.sin(a + 1)), h * 0.95, w);
      for (let i = 0; i < 5; i++) {
        aura(`rgba(91,45,191,${0.18 + 0.1 * sp})`, w * (i / 4) + w * 0.08 * Math.sin(a * 2 + i), h * (1.02 - 0.03 * Math.sin(a * 3 + i * 1.7)), w * 0.35);
      }

      // Diagonal light slashes.
      for (let i = 0; i < 3; i++) {
        const t = (phase * 3 + i / 3) % 1;
        const x = -w * 0.5 + t * w * 2;
        const g = ctx.createLinearGradient(x, 0, x - h * 0.5, h);
        g.addColorStop(0, "rgba(79,195,247,0)");
        g.addColorStop(0.5, "rgba(79,195,247,0.07)");
        g.addColorStop(1, "rgba(79,195,247,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 2 + 30 * ((i + 1) % 2);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - h * 0.5, h);
        ctx.stroke();
      }

      for (const m of motes) {
        const y = (((m.y - phase * m.speed * 8) % 1) + 1) % 1;
        const x = m.x + 0.015 * Math.sin((phase * 10 + m.seed) * Math.PI * 2);
        const fade = Math.max(0, Math.sin(y * Math.PI));
        const rgb = m.purple ? "155,107,255" : "168,240,255";
        aura(`rgba(${rgb},${0.35 * fade})`, x * w, y * h, m.size * 6);
        ctx.fillStyle = `rgba(${rgb},${0.9 * fade})`;
        ctx.beginPath();
        ctx.arc(x * w, y * h, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="bg-canvas" />;
}
