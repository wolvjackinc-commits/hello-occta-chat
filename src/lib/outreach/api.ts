import { supabase } from "@/integrations/supabase/client";

export type OutreachSettings = {
  id: number;
  sending_enabled: boolean;
  from_name: string;
  from_email: string | null;
  reply_to: string;
  daily_cap: number;
  hourly_cap: number;
  window_start_hour: number;
  window_end_hour: number;
  weekdays_only: boolean;
  recontact_cooldown_days: number;
  postal_address: string;
  last_worker_run_at: string | null;
  last_worker_result: Record<string, unknown> | null;
};

export type OutreachContact = {
  id: string;
  business_name: string;
  email: string;
  email_type: string;
  category: string | null;
  subcategory: string | null;
  address: string | null;
  postcode: string | null;
  area: string | null;
  district: string | null;
  phone: string | null;
  website: string | null;
  legal_form: string;
  companies_house_number: string | null;
  companies_house_verified: boolean;
  companies_house_match_basis: string | null;
  lawful_basis: string;
  consent_evidence: string | null;
  priority: string | null;
  tags: string[];
  source: string | null;
  source_urls: string | null;
  why_good_fit: string | null;
  notes: string | null;
  status: string;
  import_batch: string | null;
  last_contacted_at: string | null;
  eligible: boolean;
  created_at: string;
};

export type OutreachTemplate = {
  id: string;
  template_key: string;
  name: string;
  flyer_ref: string | null;
  subject: string;
  preheader: string | null;
  body_html: string;
  body_text: string;
  cta_label: string;
  cta_path: string;
  hero_image_url: string | null;
  is_active: boolean;
  updated_at: string;
};

export type OutreachAudience = {
  categories?: string[];
  priorities?: string[];
  districts?: string[];
  tags?: string[];
  contact_ids?: string[];
};

export type OutreachCampaign = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "scheduled" | "sending" | "paused" | "completed" | "cancelled";
  template_id: string | null;
  subject: string | null;
  preheader: string | null;
  body_html: string | null;
  body_text: string | null;
  cta_label: string | null;
  cta_path: string | null;
  hero_image_url: string | null;
  flyer_ref: string | null;
  template_key: string | null;
  audience: OutreachAudience;
  total_recipients: number;
  scheduled_at: string | null;
  launched_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_reason: string | null;
  notes: string | null;
  created_at: string;
};

export type OutreachStats = {
  campaign_id: string;
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  failed: number;
  suppressed: number;
  replied: number;
  converted: number;
};

export type OutreachMessage = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  business_name: string | null;
  status: string;
  attempt_count: number;
  last_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  first_opened_at: string | null;
  open_count: number;
  first_clicked_at: string | null;
  click_count: number;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  replied_at: string | null;
  converted_at: string | null;
  converted_lead_id: string | null;
  converted_source: string | null;
};

export type OutreachEvent = {
  id: number;
  message_id: string | null;
  campaign_id: string | null;
  event_type: string;
  url: string | null;
  suspected_bot: boolean;
  meta: Record<string, unknown>;
  occurred_at: string;
};

export type OutreachSuppression = {
  email: string;
  reason: string;
  source: string | null;
  note: string | null;
  created_at: string;
};

/** Typed tables the generated Supabase types don't know about yet. */
export const outreachTable = (name: string) => supabase.from(name as never);

export class OutreachActionError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  constructor(code: string, message: string, details: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** Call the outreach-admin edge function and surface its JSON error body. */
export async function outreachAction<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("outreach-admin", { body: { action, ...payload } });
  if (error) {
    let body: Record<string, unknown> = {};
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === "function") {
      body = await (ctx as Response).clone().json().catch(() => ({}));
    }
    const code = typeof body.error === "string" ? body.error : "request_failed";
    const problems = Array.isArray(body.problems) ? (body.problems as string[]).join(" · ") : "";
    const message = (typeof body.message === "string" && body.message) || problems || code.replace(/_/g, " ") || error.message;
    throw new OutreachActionError(code, message, body);
  }
  return data as T;
}

export const CAMPAIGN_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  scheduled: "bg-indigo-100 text-indigo-800",
  sending: "bg-blue-100 text-blue-800",
  paused: "bg-amber-100 text-amber-900",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-600",
};

export const MESSAGE_STATUS_STYLES: Record<string, string> = {
  queued: "bg-gray-100 text-gray-800",
  sending: "bg-blue-100 text-blue-800",
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  bounced: "bg-red-100 text-red-800",
  complained: "bg-red-200 text-red-900",
  suppressed: "bg-amber-100 text-amber-900",
  cancelled: "bg-gray-200 text-gray-600",
};

export function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}
