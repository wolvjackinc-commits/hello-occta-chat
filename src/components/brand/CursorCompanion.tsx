import { useEffect, useRef, useState } from "react";

/* A square that trails the pointer and swells over anything clickable. It never
   replaces the system cursor, ignores text fields, and is only mounted for mouse
   or trackpad users who haven't asked for reduced motion. */

const INTERACTIVE = "a, button, [role='button'], [role='tab'], summary, label, select";
const TEXT_ENTRY = "input, textarea, [contenteditable='true']";

const CursorCompanion = () => {
  const [enabled, setEnabled] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEnabled(fine && !calm);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const box = boxRef.current;
    if (!box) return;

    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let scale = 1;
    let targetScale = 1;
    let shown = false;
    let raf = 0;

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.22;
      pos.y += (target.y - pos.y) * 0.22;
      scale += (targetScale - scale) * 0.2;
      box.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      const settled =
        Math.abs(target.x - pos.x) < 0.1 && Math.abs(target.y - pos.y) < 0.1 && Math.abs(targetScale - scale) < 0.01;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!shown) {
        pos.x = target.x;
        pos.y = target.y;
        shown = true;
      }
      const el = e.target instanceof Element ? e.target : null;
      const typing = !!el?.closest(TEXT_ENTRY);
      const hot = !typing && !!el?.closest(INTERACTIVE);
      targetScale = hot ? 1.9 : 1;
      box.dataset.hot = String(hot);
      box.style.opacity = typing ? "0" : "1";
      wake();
    };
    const onLeave = () => {
      box.style.opacity = "0";
    };
    const onDown = () => {
      targetScale *= 0.8;
      wake();
    };
    const onUp = () => {
      targetScale = box.dataset.hot === "true" ? 1.9 : 1;
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={boxRef} aria-hidden className="occ-cursor" style={{ opacity: 0 }} />;
};

export default CursorCompanion;
