import { useEffect, useRef, useState } from "react";

/* The poster heroes' signature background: a dot grid that ripples like a radio
   signal. The cursor (or a tap) sends out waves, and the field pings on its own
   every few seconds so it feels alive on touch screens too.

   It only animates while on screen and while the tab is visible, caps the pixel
   ratio, and falls back to the static CSS grid for reduced-motion visitors. */

const SPACING = 28;
const WAVE_SPEED = 0.42; // px per ms
const WAVE_WIDTH = 70;
const WAVE_LIFE = 2600; // ms
const AUTO_PING_EVERY = 3400; // ms
const GLOW_RADIUS = 150;

type Wave = { x: number; y: number; t0: number; strength: number };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SignalField = ({ className = "" }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(!prefersReducedMotion());
  }, []);

  useEffect(() => {
    if (!animated) return;
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let lastAuto = performance.now() - AUTO_PING_EVERY + 900;
    let lastCursorWave = 0;
    const waves: Wave[] = [];
    const cursor = { x: -9999, y: -9999, active: false };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const local = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const p = local(e);
      cursor.x = p.x;
      cursor.y = p.y;
      cursor.active = true;
      const now = performance.now();
      if (now - lastCursorWave > 420) {
        waves.push({ x: p.x, y: p.y, t0: now, strength: 0.55 });
        lastCursorWave = now;
      }
    };
    const onLeave = () => {
      cursor.active = false;
    };
    const onDown = (e: PointerEvent) => {
      const p = local(e);
      waves.push({ x: p.x, y: p.y, t0: performance.now(), strength: 1 });
    };

    const draw = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;

      if (now - lastAuto > AUTO_PING_EVERY) {
        // Auto pings come from the upper right, where the "24" ghost sits.
        waves.push({ x: width * (0.62 + Math.random() * 0.3), y: height * (0.15 + Math.random() * 0.35), t0: now, strength: 0.85 });
        lastAuto = now;
      }
      for (let i = waves.length - 1; i >= 0; i -= 1) {
        if (now - waves[i].t0 > WAVE_LIFE) waves.splice(i, 1);
      }

      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;

      for (let r = 0; r < rows; r += 1) {
        const y = r * SPACING;
        for (let c = 0; c < cols; c += 1) {
          const x = c * SPACING;
          let energy = 0;

          for (const w of waves) {
            const age = now - w.t0;
            const radius = age * WAVE_SPEED;
            const d = Math.hypot(x - w.x, y - w.y);
            const band = 1 - Math.abs(d - radius) / WAVE_WIDTH;
            if (band > 0) energy += band * w.strength * (1 - age / WAVE_LIFE);
          }
          if (cursor.active) {
            const d = Math.hypot(x - cursor.x, y - cursor.y);
            if (d < GLOW_RADIUS) energy += (1 - d / GLOW_RADIUS) * 0.6;
          }

          if (energy < 0.04) {
            ctx.fillStyle = "rgba(255,255,255,0.09)";
            ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
          } else {
            const e = Math.min(energy, 1);
            const size = 1.5 + e * 2.5;
            ctx.fillStyle = `rgba(255,230,0,${0.15 + e * 0.8})`;
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(host);
    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
    };
  }, [animated]);

  if (!animated) return <div aria-hidden className={`hero-grid pointer-events-none absolute inset-0 ${className}`} />;

  return <canvas ref={canvasRef} aria-hidden className={`signal-field pointer-events-none absolute inset-0 ${className}`} />;
};

export default SignalField;
