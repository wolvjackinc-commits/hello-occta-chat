import { motion } from "framer-motion";
import { ReactNode } from "react";

interface BrutalCardProps {
  children: ReactNode;
  className?: string;
  index?: number;
}

// Brutalist card with aggressive hover
const BrutalCard = ({ children, className = "", index = 0 }: BrutalCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -1 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{
        y: -8,
        x: -4,
        boxShadow: "12px 12px 0px 0px hsl(var(--foreground))",
        transition: { duration: 0.15, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default BrutalCard;
