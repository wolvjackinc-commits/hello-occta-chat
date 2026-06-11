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
  "Real Live Worldpay webhook signing secret still required.",
  "Valid signed webhook must mark one internal payment request paid with webhook_verified=true.",
  "Invalid signature or wrong-amount webhook must be rejected (fail-closed).",
  "Supplier order phase not built yet.",
  "Service activation phase not built yet.",
  "Billing / DD / invoice automation not built in current phase.",
];

export const GO_LIVE_BANNER =
  "OCCTA is safe for controlled quote/contract/payment-page testing only. It is not yet safe for full live customer provisioning.";