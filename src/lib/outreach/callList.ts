// Ranking for the outreach call list: who to phone first after an email.

export type CallListRow = {
  id: string;
  campaign_id: string;
  email: string;
  business_name: string | null;
  sent_at: string | null;
  first_opened_at: string | null;
  open_count: number;
  first_clicked_at: string | null;
  click_count: number;
  replied_at: string | null;
  converted_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  contact: {
    phone: string | null;
    category: string | null;
    area: string | null;
    district: string | null;
    website: string | null;
  } | null;
};

/** Sectors where alarms, lifts, door entry or card machines make the switch-off urgent. */
const URGENT_SECTORS = /(care|health|medical|charit|church|community|accommodation|hotel|retail|hospitality)/i;

/** Higher is warmer. Clicks beat repeat opens beat a single open. */
export function callPriority(r: CallListRow): number {
  let score = 0;
  if (r.first_clicked_at) score += 100 + Math.min(r.click_count, 5) * 5;
  score += Math.min(r.open_count, 6) * 6;
  if (r.contact?.category && URGENT_SECTORS.test(r.contact.category)) score += 4;
  return score;
}

/** People we can reasonably ring: engaged, reachable by phone, not opted out or bounced. */
export function isCallable(r: CallListRow): boolean {
  if (!r.first_opened_at && !r.first_clicked_at) return false;
  if (r.unsubscribed_at || r.bounced_at || r.complained_at) return false;
  return Boolean(r.contact?.phone && r.contact.phone.replace(/\D/g, "").length >= 9);
}

export function engagementLabel(r: CallListRow): string {
  if (r.converted_at) return "Enquired";
  if (r.first_clicked_at) return r.click_count > 1 ? `Clicked ${r.click_count}×` : "Clicked";
  return r.open_count > 1 ? `Opened ${r.open_count}×` : "Opened";
}

/** Open first, then warmest first; people already dealt with sink to the bottom. */
export function rankCallList(rows: readonly CallListRow[]): CallListRow[] {
  return rows
    .filter(isCallable)
    .slice()
    .sort((a, b) => {
      const doneA = a.replied_at || a.converted_at ? 1 : 0;
      const doneB = b.replied_at || b.converted_at ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      const diff = callPriority(b) - callPriority(a);
      if (diff) return diff;
      return (b.first_opened_at ?? "").localeCompare(a.first_opened_at ?? "");
    });
}

/** tel: link for a UK number as typed on a website. */
export function telHref(phone: string): string {
  // "+44 (0)1484 ..." is written with a trunk 0 that mustn't be dialled after +44.
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+440/, "+44");
  return `tel:${digits}`;
}
