/// <reference types="vite/client" />

declare const __BUILD_VERSION__: string;

// `process.env` used inside MCP tool files that are re-emitted into the Deno
// edge function bundle. Never referenced by browser code.
declare const process: { env: Record<string, string | undefined> };
