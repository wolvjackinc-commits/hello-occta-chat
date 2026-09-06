import { trackSwitch50 } from "@/lib/switch50Analytics";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CACHE_KEY = "occta_switch50_public_status_v1";
const CACHE_MS = 5 * 60 * 1000;

type PublicCampaign = {
  code: string;
  title: string;
  reward_amount: number;
  reward_currency: string;
  starts_at: string;
  ends_at: string;
  terms_version: string;
  terms_text: string;
  landing_path: string;
  payout_rule: string;
  monthly_price_reduced: false;
};

type PublicStatus = { active: boolean; campaign?: PublicCampaign | null };

function landingUrl(content: string) {
  const p = new URLSearchParams({
    offer: "SWITCH50",
    utm_source: "occta",
    utm_medium: "onsite",
    utm_campaign: "SWITCH50",
    utm_content: content,
  });
  const incoming = new URLSearchParams(window.location.search);
  for (const key of ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"]) {
    const value = incoming.get(key); if (value) p.set(key, value.slice(0,300));
  }
  return `/broadband?${p.toString()}`;
}

function track(event: string, extra: Record<string, unknown> = {}) { trackSwitch50(event, extra); }

export default function Switch50CampaignStrip() {
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { at: number; value: PublicStatus };
          if (Date.now() - parsed.at < CACHE_MS) {
            if (!cancelled) setCampaign(parsed.value.active ? parsed.value.campaign ?? null : null);
            return;
          }
        }
      } catch { /* ignore cache */ }

      const { data, error } = await supabase.functions.invoke("switch50-public", { body: {} });
      if (error || !data) { if (!cancelled) setCampaign(null); return; }
      const value: PublicStatus = { active: !!(data as any).active, campaign: (data as any).campaign ?? null };
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value })); } catch { /* ignore */ }
      if (!cancelled) {
        setCampaign(value.active ? value.campaign ?? null : null);
        if (value.active) track("view_promotion", { creative_name: "global_switch50_strip" });
      }
    };
    load();
    const refresh = window.setInterval(load, CACHE_MS);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    if (!campaign) return;
    const remaining = Date.parse(campaign.ends_at) - Date.now();
    if (remaining <= 0) { setCampaign(null); return; }
    // Avoid the signed 32-bit timeout overflow for offers several weeks away.
    if (remaining > 2_147_483_647) return;
    const expiry = window.setTimeout(() => setCampaign(null), remaining + 1);
    return () => window.clearTimeout(expiry);
  }, [campaign]);

  const endDate = useMemo(() => campaign?.ends_at
    ? new Date(campaign.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    : "31 October 2026", [campaign?.ends_at]);

  if (!campaign || Date.now() > Date.parse(campaign.ends_at)) return null;

  return (
    <>
      <section className="relative z-40 border-b-4 border-foreground bg-primary text-primary-foreground" aria-label="SWITCH50 broadband promotion">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center border-2 border-primary-foreground">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display uppercase text-lg leading-none md:text-xl">£50 back. Your price stays put.</p>
                <p className="mt-1 text-xs font-medium md:text-sm">
                  Essential Fibre £34.99/month incl. VAT · Price Lock 24 · new residential customers · order by {endDate}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={landingUrl("global_strip")}
                onClick={() => track("select_promotion", { creative_name: "global_switch50_strip" })}
                className="inline-flex items-center gap-2 border-2 border-primary-foreground bg-primary-foreground px-4 py-2 font-display text-xs uppercase text-primary transition-opacity hover:opacity-90"
              >
                Check your address <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => { setTermsOpen(true); track("switch50_terms_opened"); }}
                className="inline-flex items-center gap-2 border-2 border-primary-foreground px-4 py-2 font-display text-xs uppercase"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Offer terms
              </button>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-4 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-display uppercase text-2xl">SWITCH50 — £50 Switch Cash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="border-2 border-foreground bg-primary/10 p-4">
              <p className="font-display uppercase">What you pay</p>
              <p className="mt-1">Eligible Essential Fibre Price Lock 24 remains <strong>£34.99/month including VAT</strong>. The £50 reward is separate and does not reduce the monthly broadband price.</p>
            </div>
            <div>
              <p className="font-display uppercase">How the reward works</p>
              <p className="mt-1 text-muted-foreground">{campaign.payout_rule}</p>
            </div>
            <div>
              <p className="font-display uppercase">Full promotion terms</p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">{campaign.terms_text}</p>
            </div>
            <p className="text-xs text-muted-foreground">Promotion version: {campaign.terms_version}. Address availability, estimated line speed, setup, equipment and any one-off charges are confirmed before you accept the contract.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
