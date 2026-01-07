import { useState, useEffect } from 'react';

export const useAppMode = () => {
  const [isAppMode, setIsAppMode] = useState(false);

  useEffect(() => {
    // Check if running as installed PWA (standalone mode)
    const checkAppMode = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const isInWebAppiOS = (window.navigator as any).standalone;
      
      setIsAppMode(isStandalone || isIOSStandalone || isInWebAppiOS);
    };

    checkAppMode();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsAppMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { isAppMode };
};
