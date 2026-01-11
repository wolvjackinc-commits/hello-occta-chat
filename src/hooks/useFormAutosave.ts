import { useEffect, useCallback, useRef } from "react";

const AUTOSAVE_DEBOUNCE_MS = 1000;

interface UseFormAutosaveOptions<T> {
  key: string;
  data: T;
  enabled?: boolean;
}

export function useFormAutosave<T>({ key, data, enabled = true }: UseFormAutosaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save data to localStorage with debouncing
  const saveData = useCallback(() => {
    if (!enabled) return;
    
    try {
      const savedData = {
        data,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(savedData));
    } catch (error) {
      console.error("Failed to autosave form data:", error);
    }
  }, [key, data, enabled]);

  // Debounced save effect
  useEffect(() => {
    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(saveData, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveData, enabled]);

  // Load saved data
  const loadSavedData = useCallback((): { data: T; savedAt: string } | null => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;
      
      const parsed = JSON.parse(saved);
      
      // Check if data is older than 24 hours
      const savedAt = new Date(parsed.savedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        localStorage.removeItem(key);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error("Failed to load autosaved form data:", error);
      return null;
    }
  }, [key]);

  // Clear saved data
  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to clear autosaved form data:", error);
    }
  }, [key]);

  // Check if there's saved data
  const hasSavedData = useCallback((): boolean => {
    return loadSavedData() !== null;
  }, [loadSavedData]);

  return {
    loadSavedData,
    clearSavedData,
    hasSavedData,
  };
}
