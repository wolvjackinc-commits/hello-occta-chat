import { motion, useScroll, useSpring } from "framer-motion";

/** Thin yellow bar along the top of the viewport that fills as a long page is read. */
const ReadingProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 origin-left bg-primary"
      style={{ scaleX }}
    />
  );
};

export default ReadingProgress;
