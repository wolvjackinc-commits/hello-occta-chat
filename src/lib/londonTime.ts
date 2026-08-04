/**
 * UK (Europe/London) date-time helpers.
 *
 * Timestamps are always stored in the database as UTC (timestamptz). These
 * helpers convert between UK wall-clock values shown in admin inputs and the
 * UTC instants persisted in Postgres, and format for display in en-GB.
 */

const LONDON = "Europe/London";

/** Minutes that Europe/London is ahead of UTC at the given instant. */
function londonOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return Math.round((asIfUtc - instant.getTime()) / 60000);
}

/**
 * Convert a UK wall-clock date ("yyyy-MM-dd") + time ("HH:mm") into a UTC ISO
 * string safe to store in timestamptz columns.
 */
export function londonWallToUtcIso(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "09:00").split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offset = londonOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000).toISOString();
}

/** Split a stored UTC timestamp into UK wall-clock date + time input values. */
export function utcIsoToLondonParts(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

/** "04/08/2026, 14:30" — UK format, London timezone. */
export function formatLondonDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: LONDON,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "4 August 2026 at 14:30" — long UK format for customer-facing emails. */
export function formatLondonLong(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).toLocaleDateString("en-GB", {
    timeZone: LONDON,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const t = new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: LONDON,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${d} at ${t}`;
}

/** UK calendar day key ("yyyy-MM-dd") for an instant, in London time. */
export function londonDayKey(iso: string | Date): string {
  return utcIsoToLondonParts(typeof iso === "string" ? iso : iso.toISOString()).date;
}

/** Today's UK calendar day key. */
export function londonToday(): string {
  return londonDayKey(new Date());
}