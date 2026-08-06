/**
 * Build version stamp — generated at build time via Vite's `define`.
 * Each deploy produces a unique value so we can detect stale shells.
 */
export const BUILD_VERSION: string =
  // Injected by vite.config.ts `define`; declared in src/vite-env.d.ts.
  typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : "dev";

// Log once on startup for debugging
if (typeof window !== "undefined") {
  console.info(`[OCCTA] build ${BUILD_VERSION}`);
}
