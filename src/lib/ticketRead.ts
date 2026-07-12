// Lightweight per-user read tracking for support tickets.
// Stored in localStorage as a map of ticketId -> ISO of the updated_at value
// we last acknowledged. A ticket counts as "unread" while its current
// updated_at is newer than the stored one (or no entry exists yet).

const KEY_PREFIX = "occta:tickets:read:";
const EVENT = "occta:tickets-read-changed";

type ReadMap = Record<string, string>;

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function getReadMap(userId: string): ReadMap {
  if (!userId || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as ReadMap) : {};
  } catch {
    return {};
  }
}

function saveMap(userId: string, map: ReadMap) {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(map));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // ignore storage errors
  }
}

export function isTicketUnread(
  userId: string,
  ticket: { id: string; updated_at?: string | null; created_at: string },
  map?: ReadMap
): boolean {
  const m = map ?? getReadMap(userId);
  const stamp = ticket.updated_at || ticket.created_at;
  const seen = m[ticket.id];
  if (!seen) return true;
  return new Date(stamp).getTime() > new Date(seen).getTime();
}

export function markTicketRead(
  userId: string,
  ticket: { id: string; updated_at?: string | null; created_at: string }
) {
  if (!userId) return;
  const map = getReadMap(userId);
  map[ticket.id] = ticket.updated_at || ticket.created_at;
  saveMap(userId, map);
}

export function markAllTicketsRead(
  userId: string,
  tickets: { id: string; updated_at?: string | null; created_at: string }[]
) {
  if (!userId) return;
  const map = getReadMap(userId);
  for (const t of tickets) {
    map[t.id] = t.updated_at || t.created_at;
  }
  saveMap(userId, map);
}

export const TICKETS_READ_EVENT = EVENT;