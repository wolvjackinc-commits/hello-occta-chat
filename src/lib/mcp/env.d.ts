// Ambient declarations for MCP tool files that run inside the emitted Deno
// edge function. `process.env` is provided by Deno at runtime; the frontend
// build never executes these tool bodies, but TypeScript still typechecks them.
export {};

declare global {
  const process: { env: Record<string, string | undefined> };
}