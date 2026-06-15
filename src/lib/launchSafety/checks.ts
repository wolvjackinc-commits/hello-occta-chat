export type ReadinessStatus =
  | "ready"
  | "blocked"
  | "locked"
  | "prepared"
  | "draft-only";

export const statusLabel: Record<ReadinessStatus, string> = {
  ready: "Ready",
  blocked: "Blocked",
  locked: "Locked",
  prepared: "Prepared (locked)",
  "draft-only": "Draft only",
};

export const statusTone: Record<ReadinessStatus, string> = {
  ready: "bg-emerald-600 text-white",
  blocked: "bg-destructive text-destructive-foreground",
  locked: "bg-muted text-foreground border border-foreground",
  prepared: "bg-amber-500 text-black",
  "draft-only": "bg-foreground text-background",
};

export const HARD_BLOCKERS: string[] = [
  "Supplier order phase not built yet.",
  "Service activation phase not built yet.",
  "Billing / DD / invoice automation not built in current phase.",
];

export const GO_LIVE_BANNER =
  "Payment verification is live and verified via Worldpay SMB webhook. Supplier automation remains locked; use manual fulfilment.";