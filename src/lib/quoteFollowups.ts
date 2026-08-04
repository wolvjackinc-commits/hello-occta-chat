import { londonDayKey, londonToday } from "@/lib/londonTime";

export const FOLLOWUP_CHANNELS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
] as const;

export const FOLLOWUP_OUTCOMES = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "no_answer", label: "No answer" },
  { value: "spoke_to_customer", label: "Spoke to customer" },
  { value: "information_requested", label: "Information requested" },
  { value: "quote_discussed", label: "Quote discussed" },
  { value: "call_back_requested", label: "Call back requested" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "converted", label: "Converted" },
  { value: "other", label: "Other" },
] as const;

export const channelLabel = (v?: string | null) =>
  FOLLOWUP_CHANNELS.find((c) => c.value === v)?.label ?? v ?? "—";
export const outcomeLabel = (v?: string | null) =>
  FOLLOWUP_OUTCOMES.find((o) => o.value === v)?.label ?? v ?? "—";

export type FollowUp = {
  id: string;
  quote_request_id: string;
  followup_at: string;
  channel: string;
  outcome: string;
  notes: string;
  next_followup_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  sent_at: string | null;
  sent_to: string | null;
  sent_subject: string | null;
  sent_message_html: string | null;
  send_reference: string | null;
  send_status: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpDueState = "overdue" | "today" | "upcoming" | "none" | "completed";

export const FOLLOWUP_FILTERS = [
  { value: "all", label: "All follow-ups" },
  { value: "due_today", label: "Follow-up due today" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
  { value: "none", label: "No follow-up set" },
  { value: "completed", label: "Completed / Converted" },
] as const;

/** Latest live follow-up per quote request (newest first ordering assumed). */
export function groupFollowUps(rows: FollowUp[]): Record<string, FollowUp[]> {
  const map: Record<string, FollowUp[]> = {};
  for (const r of rows) {
    if (r.deleted_at) continue;
    (map[r.quote_request_id] ||= []).push(r);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.followup_at < b.followup_at ? 1 : -1));
  }
  return map;
}

/** The soonest pending next-follow-up across a request's follow-ups. */
export function nextFollowUp(list?: FollowUp[]): FollowUp | null {
  if (!list?.length) return null;
  const withNext = list.filter((f) => !!f.next_followup_at);
  if (!withNext.length) return null;
  return withNext.sort((a, b) => (a.next_followup_at! < b.next_followup_at! ? -1 : 1))[0];
}

export function dueState(
  list: FollowUp[] | undefined,
  requestStatus?: string | null,
): FollowUpDueState {
  const isConverted =
    requestStatus === "converted" ||
    (list ?? []).some((f) => f.outcome === "converted");
  const next = nextFollowUp(list);
  if (!next?.next_followup_at) return isConverted ? "completed" : "none";
  const today = londonToday();
  const day = londonDayKey(next.next_followup_at);
  if (isConverted) return "completed";
  if (day === today) return "today";
  if (day < today) return "overdue";
  return "upcoming";
}

export function matchesFollowUpFilter(
  filter: string,
  list: FollowUp[] | undefined,
  requestStatus?: string | null,
): boolean {
  if (filter === "all") return true;
  const state = dueState(list, requestStatus);
  if (filter === "due_today") return state === "today";
  if (filter === "overdue") return state === "overdue";
  if (filter === "upcoming") return state === "upcoming";
  if (filter === "none") return state === "none";
  if (filter === "completed") return state === "completed";
  return true;
}