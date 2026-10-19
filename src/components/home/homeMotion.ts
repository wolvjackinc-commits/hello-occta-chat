import type { Variants } from "framer-motion";

/* Reveal motion shared by the homepage sections (see homeKit.tsx). */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export const revealParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
