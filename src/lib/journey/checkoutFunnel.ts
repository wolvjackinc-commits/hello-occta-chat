/**
 * Pure reporting helpers for the admin Journey Control checkout funnel.
 *
 * The `admin_checkout_session_list` RPC already restricts rows to the last
 * 30 days, excludes test sessions and excludes generic web-tracking rows that
 * duplicate a Journey 2 session. These helpers only derive counts, so the
 * denominators stated in the UI stay in one place and can be unit tested.
 */

/** Reporting window enforced by admin_checkout_session_list. */
export const FUNNEL_WINDOW_DAYS = 30;

/**
 * A session is only treated as *currently* active when it has been touched
 * inside this many hours. Older non-terminal sessions are "stale" and must not
 * be presented as live funnel activity.
 */
export const ACTIVE_RECENCY_HOURS = 48;

export const TERMINAL_STATUSES = ["completed", "cancelled", "abandoned"] as const;

export type FunnelRow = {
  status: string;
  last_activity_at: string | null;
  error_count?: number | null;
};

export type FunnelSummary = {
  /** All sessions started inside the reporting window. */
  started: number;
  /** Non-terminal sessions touched within ACTIVE_RECENCY_HOURS. */
  activeRecent: number;
  /** Non-terminal sessions not touched within ACTIVE_RECENCY_HOURS. */
  activeStale: number;
  abandoned: number;
  completed: number;
  cancelled: number;
  withErrors: number;
  /** Denominator for conversion: started sessions excluding cancelled ones. */
  eligibleStarted: number;
  /** completed / eligibleStarted, as a whole percentage. Null when no data. */
  conversionRate: number | null;
};

export function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isRecentlyActive(
  row: FunnelRow,
  now: number = Date.now(),
  hours: number = ACTIVE_RECENCY_HOURS,
): boolean {
  if (isTerminal(row.status)) return false;
  if (!row.last_activity_at) return false;
  const ts = new Date(row.last_activity_at).getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts <= hours * 3_600_000;
}

export function summariseCheckoutFunnel(rows: FunnelRow[], now: number = Date.now()): FunnelSummary {
  let activeRecent = 0;
  let activeStale = 0;
  let abandoned = 0;
  let completed = 0;
  let cancelled = 0;
  let withErrors = 0;

  for (const row of rows) {
    if (row.status === "completed") completed += 1;
    else if (row.status === "cancelled") cancelled += 1;
    else if (row.status === "abandoned") abandoned += 1;
    else if (isRecentlyActive(row, now)) activeRecent += 1;
    else activeStale += 1;

    if ((row.error_count ?? 0) > 0) withErrors += 1;
  }

  const started = rows.length;
  const eligibleStarted = started - cancelled;

  return {
    started,
    activeRecent,
    activeStale,
    abandoned,
    completed,
    cancelled,
    withErrors,
    eligibleStarted,
    conversionRate: eligibleStarted > 0 ? Math.round((completed / eligibleStarted) * 100) : null,
  };
}

/** Human-readable description of the window and denominator used in reporting. */
export const FUNNEL_WINDOW_LABEL = `Last ${FUNNEL_WINDOW_DAYS} days · test sessions excluded`;
export const CONVERSION_DENOMINATOR_LABEL = `Completed ÷ started in last ${FUNNEL_WINDOW_DAYS} days, excluding cancelled`;
