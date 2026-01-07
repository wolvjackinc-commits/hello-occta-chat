import { useState, useRef, useCallback, ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
}

const PullToRefresh = ({ children, onRefresh, threshold = 80 }: PullToRefreshProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  
  const pullDistance = useMotionValue(0);
  const pullProgress = useTransform(pullDistance, [0, threshold], [0, 1]);
  const indicatorOpacity = useTransform(pullDistance, [0, threshold * 0.3], [0, 1]);
  const indicatorScale = useTransform(pullDistance, [0, threshold], [0.5, 1]);
  const rotation = useTransform(pullDistance, [0, threshold], [0, 180]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Apply resistance
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, threshold * 1.5);
      pullDistance.set(distance);
    }
  }, [isRefreshing, pullDistance, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    const currentPull = pullDistance.get();
    
    if (currentPull >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      animate(pullDistance, threshold, { duration: 0.2 });
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        animate(pullDistance, 0, { duration: 0.3 });
      }
    } else {
      animate(pullDistance, 0, { duration: 0.3 });
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  return (
    <div className="relative h-full overflow-hidden">
      {/* Pull indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
        style={{
          height: pullDistance,
          opacity: indicatorOpacity,
        }}
      >
        <motion.div
          className="w-10 h-10 bg-primary border-2 border-foreground flex items-center justify-center"
          style={{ scale: indicatorScale }}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <motion.div style={{ rotate: rotation }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div
        ref={containerRef}
        className="h-full overflow-y-auto"
        style={{ y: pullDistance }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
