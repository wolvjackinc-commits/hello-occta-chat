/**
 * Development-only error logging utility.
 * In production, errors are silently handled without exposing details to users.
 */

export const logError = (context: string, error: unknown) => {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
  // In production, errors are not logged to console to prevent information leakage
  // Consider adding server-side error monitoring service here (e.g., Sentry)
};

export const logWarn = (context: string, message: string) => {
  if (import.meta.env.DEV) {
    console.warn(`[${context}]`, message);
  }
};

export const logInfo = (context: string, message: string) => {
  if (import.meta.env.DEV) {
    console.log(`[${context}]`, message);
  }
};
