import React from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const SuccessCheckmark: React.FC = () => {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 15,
        delay: 0.2,
      }}
      className="relative"
    >
      {/* Pulsing rings */}
      <motion.div
        className="absolute inset-0 bg-primary/20 border-4 border-primary/30"
        initial={{ scale: 1, opacity: 0.8 }}
        animate={{ scale: 2, opacity: 0 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatDelay: 0.5,
          ease: "easeOut",
        }}
      />
      <motion.div
        className="absolute inset-0 bg-primary/20 border-4 border-primary/30"
        initial={{ scale: 1, opacity: 0.6 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatDelay: 0.5,
          ease: "easeOut",
          delay: 0.3,
        }}
      />

      {/* Main icon container */}
      <motion.div
        className="w-24 h-24 bg-primary border-4 border-foreground flex items-center justify-center relative z-10"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <CheckCircle className="w-12 h-12 text-primary-foreground" />
        </motion.div>
      </motion.div>

      {/* Sparkle effects */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-primary"
          style={{
            top: "50%",
            left: "50%",
          }}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{
            scale: [0, 1, 0],
            x: [0, (i % 2 === 0 ? 1 : -1) * 60],
            y: [0, (i < 2 ? -1 : 1) * 60],
          }}
          transition={{
            duration: 0.8,
            delay: 0.6 + i * 0.1,
            ease: "easeOut",
          }}
        />
      ))}
    </motion.div>
  );
};

export default SuccessCheckmark;
