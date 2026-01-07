import { useState, useEffect } from "react";

export const usePWA = () => {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as installed PWA
    const checkStandalone = () => {
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const isAndroidStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isDesktopStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      setIsStandalone(isIOSStandalone || isAndroidStandalone || isDesktopStandalone);
    };

    checkStandalone();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkStandalone();
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { isStandalone };
};
