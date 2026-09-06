export type OfferPromotionSnapshot = {
  code: string;
  title: string;
  eligible: boolean;
  eligibility_reason: string;
  reward_type: string;
  reward_amount: number;
  reward_currency: string;
  payout_delay_days: number;
  require_first_paid_invoice: boolean;
  one_per_address: boolean;
  starts_at: string;
  ends_at: string;
  terms_version: string;
  terms_text: string;
  landing_path: string;
  monthly_price_reduced: false;
  payout_rule: string;
};

type ResolveContext = {
  customer_type?: string | null;
  speed_bucket?: string | null;
  plan_term?: string | null;
};

const normaliseCode = (code: unknown) => String(code ?? "").trim().toUpperCase().slice(0, 40);

/**
 * Resolves an offer entirely server-side. The browser may request a code, but
 * never supplies the reward amount, dates or eligibility rules.
 */
export async function resolveOfferPromotion(
  supabase: any,
  requestedCode: unknown,
  ctx: ResolveContext = {},
): Promise<OfferPromotionSnapshot | null> {
  const code = normaliseCode(requestedCode);
  if (!code) return null;

  const { data: campaign } = await supabase
    .from("offer_campaigns")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (!campaign) return null;

  const now = Date.now();
  const starts = new Date(campaign.starts_at).getTime();
  const ends = new Date(campaign.ends_at).getTime();
  let eligible = !!campaign.active && now >= starts && now <= ends;
  let reason = eligible ? "campaign_active" : !campaign.active ? "campaign_paused" : now < starts ? "campaign_not_started" : "campaign_expired";

  if (eligible && ctx.customer_type && String(campaign.customer_type) !== String(ctx.customer_type)) {
    eligible = false;
    reason = "customer_type_not_eligible";
  }
  if (eligible && ctx.speed_bucket && String(campaign.speed_bucket) !== String(ctx.speed_bucket)) {
    eligible = false;
    reason = "speed_not_eligible";
  }
  if (eligible && ctx.plan_term && String(campaign.plan_term) !== String(ctx.plan_term)) {
    eligible = false;
    reason = "term_not_eligible";
  }

  const delay = Number(campaign.payout_delay_days ?? 30);
  const firstBill = !!campaign.require_first_paid_invoice;
  return {
    code: String(campaign.code),
    title: String(campaign.title),
    eligible,
    eligibility_reason: reason,
    reward_type: String(campaign.reward_type),
    reward_amount: Number(campaign.reward_amount ?? 0),
    reward_currency: String(campaign.reward_currency ?? "GBP"),
    payout_delay_days: delay,
    require_first_paid_invoice: firstBill,
    one_per_address: !!campaign.one_per_address,
    starts_at: String(campaign.starts_at),
    ends_at: String(campaign.ends_at),
    terms_version: String(campaign.terms_version),
    terms_text: String(campaign.terms_text),
    landing_path: String(campaign.landing_path),
    monthly_price_reduced: false,
    payout_rule: `${campaign.reward_currency ?? "GBP"} ${Number(campaign.reward_amount ?? 0).toFixed(2)} cash reward becomes eligible ${delay} days after service activation${firstBill ? " once the first broadband invoice has been paid" : ""}, provided the account remains eligible.`,
  };
}

export function campaignCodeFromUtm(utm: Record<string, string> | null | undefined): string | null {
  if (!utm) return null;
  const direct = normaliseCode(utm.offer || utm.offer_code);
  if (direct) return direct;
  const campaign = normaliseCode(utm.utm_campaign);
  return campaign === "SWITCH50" ? campaign : null;
}
