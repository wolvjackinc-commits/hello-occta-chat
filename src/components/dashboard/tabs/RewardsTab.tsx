import { useEffect, useState } from "react";
import { Gift, Users, Award, Copy, Loader2, Banknote, CheckCircle2, Clock3, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useToast } from "@/hooks/use-toast";

type Account = { points_balance: number; bill_credit_balance: number; status: string } | null;
type Code = { code: string; status: string; usage_count: number; expires_at: string | null };
type Ledger = { id: string; source_type: string; points_delta: number; bill_credit_delta: number; status: string; reason: string; created_at: string };
type Benefit = { id: string; benefit_name: string; description: string | null; value_label: string | null; terms_text: string | null; plan_type: string; customer_type: string };
type PromotionReward = {
  id: string;
  campaign_code: string;
  order_id: string;
  reward_amount: number;
  reward_currency: string;
  status: "pending" | "eligible" | "payout_queued" | "issued" | "blocked" | "reversed" | "expired";
  activation_at: string | null;
  eligibility_due_at: string | null;
  eligible_at: string | null;
  issued_at: string | null;
  created_at: string;
};

const rewardStatus = (r: PromotionReward) => {
  switch (r.status) {
    case "issued": return { label: "Paid", icon: CheckCircle2, body: "Your Switch Cash has been paid by OCCTA." };
    case "payout_queued": return { label: "Payment queued", icon: Banknote, body: "Your reward has passed the checks and is queued for payment." };
    case "eligible": return { label: "Ready for payment", icon: CheckCircle2, body: "Your reward has passed the service and billing eligibility checks." };
    case "blocked": return { label: "Needs review", icon: AlertCircle, body: "This reward is not currently payable. Contact OCCTA if you believe this is incorrect." };
    case "reversed": return { label: "Reversed", icon: AlertCircle, body: "This reward was reversed after an eligibility review. Contact OCCTA for details." };
    case "expired": return { label: "Expired", icon: AlertCircle, body: "This reward is no longer eligible for payment." };
    default: return { label: "Eligibility in progress", icon: Clock3, body: "We will automatically check activation, the first paid broadband bill and the 30-day eligibility point." };
  }
};

export function RewardsTab() {
  const { rewardsEnabled, isLoading: settingsLoading } = usePlatformSettings();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [account, setAccount] = useState<Account>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [promotionRewards, setPromotionRewards] = useState<PromotionReward[]>([]);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const promoPromise = (supabase as any).rpc("get_my_promotion_rewards");
      if (!rewardsEnabled) {
        const promo = await promoPromise;
        if (promo.error) throw promo.error;
        setPromotionRewards((promo.data ?? []) as PromotionReward[]);
        return;
      }
      const [acc, cods, led, ben, promo] = await Promise.all([
        (supabase as any).rpc("get_customer_reward_account"),
        (supabase as any).rpc("get_customer_referral_codes"),
        (supabase as any).rpc("get_customer_points_ledger", { _limit: 20 }),
        (supabase as any).rpc("get_public_contract_benefits"),
        promoPromise,
      ]);
      if (promo.error) throw promo.error;
      setAccount((acc.data?.[0] ?? null) as Account);
      setCodes((cods.data ?? []) as Code[]);
      setLedger((led.data ?? []) as Ledger[]);
      setBenefits((ben.data ?? []) as Benefit[]);
      setPromotionRewards((promo.data ?? []) as PromotionReward[]);
    } catch {
      setLoadError("Your reward status could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [rewardsEnabled]);

  async function createCode() {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-referral-code", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Referral code created" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Couldn't create code", description: e?.message ?? "Try again later", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function copyLink(code: string) {
    const url = `https://www.occta.co.uk/?ref=${code}`;
    try {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  }

  if (settingsLoading || loading) {
    return <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading rewards…</div>;
  }

  if (loadError) return <div role="alert" className="p-6 space-y-3"><p>{loadError}</p><Button onClick={() => void loadAll()}>Retry</Button></div>;

  const switchCashSection = promotionRewards.length > 0 ? (
    <div className="space-y-3">
      <div>
        <p className="font-display uppercase text-xl flex items-center gap-2"><Banknote className="w-5 h-5" /> Switch Cash</p>
        <p className="text-xs text-muted-foreground mt-1">Cash promotions are tracked separately from points and bill credits.</p>
      </div>
      {promotionRewards.map((r) => {
        const s = rewardStatus(r);
        const Icon = s.icon;
        return (
          <div key={r.id} className="border-4 border-foreground bg-primary/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <p className="font-display uppercase">{r.campaign_code} · {s.label}</p>
                </div>
                <p className="mt-1 text-sm">{s.body}</p>
                {r.activation_at && <p className="mt-2 text-xs text-muted-foreground">Service activated: {new Date(r.activation_at).toLocaleDateString("en-GB")}</p>}
                {r.eligibility_due_at && r.status === "pending" && <p className="text-xs text-muted-foreground">Earliest reward check: {new Date(r.eligibility_due_at).toLocaleDateString("en-GB")}</p>}
                {r.issued_at && <p className="text-xs text-muted-foreground">Payment recorded: {new Date(r.issued_at).toLocaleDateString("en-GB")}</p>}
              </div>
              <div className="shrink-0 border-2 border-foreground bg-background px-4 py-3 text-center">
                <p className="text-[11px] font-display uppercase text-muted-foreground">Switch Cash</p>
                <p className="font-display text-3xl">£{Number(r.reward_amount).toFixed(2)}</p>
              </div>
            </div>
            <p className="mt-3 border-t border-foreground/20 pt-3 text-[11px] text-muted-foreground">
              The cash reward is separate from your broadband bill and does not reduce your contracted monthly broadband price. Eligibility is checked against the accepted promotion terms.
            </p>
          </div>
        );
      })}
    </div>
  ) : null;

  if (!rewardsEnabled) {
    return (
      <div className="space-y-6">
        {switchCashSection}
        <div className="p-4 border-4 border-foreground bg-muted/30">
          <p className="font-display uppercase">Points & referral rewards are coming soon</p>
          <p className="text-sm text-muted-foreground mt-1">This does not affect any SWITCH50 cash reward shown above.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { icon: Users, title: "Referral link", body: "Coming soon" },
            { icon: Award, title: "Points balance", body: "Coming soon" },
            { icon: Gift, title: "Contract Saver benefits", body: "Coming soon" },
          ].map((c) => (
            <div key={c.title} className="p-4 border-2 border-foreground bg-background">
              <c.icon className="w-6 h-6 mb-2" />
              <p className="font-display uppercase">{c.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeCode = codes.find((c) => c.status === "active");

  return (
    <div className="space-y-6">
      {switchCashSection}

      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-4 border-2 border-foreground bg-background">
          <p className="text-xs font-display uppercase text-muted-foreground">Points balance</p>
          <p className="text-3xl font-display mt-1">{account?.points_balance ?? 0}</p>
        </div>
        <div className="p-4 border-2 border-foreground bg-background">
          <p className="text-xs font-display uppercase text-muted-foreground">Bill credit balance</p>
          <p className="text-3xl font-display mt-1">£{(account?.bill_credit_balance ?? 0).toFixed(2)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Bill credits will apply to a future invoice once activated.</p>
        </div>
      </div>

      <div className="p-4 border-4 border-foreground">
        <p className="font-display uppercase mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Your referral link</p>
        {activeCode ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="px-2 py-1 border-2 border-foreground bg-muted font-mono text-sm">{`https://www.occta.co.uk/?ref=${activeCode.code}`}</code>
              <Button size="sm" variant="outline" onClick={() => copyLink(activeCode.code)} className="font-display uppercase">
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Uses: {activeCode.usage_count}</p>
          </div>
        ) : (
          <Button onClick={createCode} disabled={creating} className="font-display uppercase">
            {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create my referral code"}
          </Button>
        )}
      </div>

      {benefits.length > 0 && (
        <div className="p-4 border-2 border-foreground">
          <p className="font-display uppercase mb-3 flex items-center gap-2"><Gift className="w-4 h-4" /> Active contract benefits</p>
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b.id} className="border-l-4 border-primary pl-3">
                <p className="font-display uppercase text-sm">{b.benefit_name} {b.value_label && <span className="text-primary">— {b.value_label}</span>}</p>
                {b.description && <p className="text-xs text-muted-foreground mt-1">{b.description}</p>}
                {b.terms_text && <p className="text-[11px] text-muted-foreground mt-1">Terms: {b.terms_text}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4 border-2 border-foreground">
        <p className="font-display uppercase mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Recent points & credit activity</p>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">No points or bill-credit activity yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {ledger.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 border-b border-foreground/10 pb-2">
                <div>
                  <p className="font-display uppercase text-xs">{row.source_type.replace(/_/g, " ")} · {row.status}</p>
                  <p className="text-xs text-muted-foreground">{row.reason}</p>
                </div>
                <div className="text-right whitespace-nowrap">
                  {row.points_delta !== 0 && <p>{row.points_delta > 0 ? "+" : ""}{row.points_delta} pts</p>}
                  {Number(row.bill_credit_delta) !== 0 && <p>{Number(row.bill_credit_delta) > 0 ? "+" : ""}£{Number(row.bill_credit_delta).toFixed(2)}</p>}
                  <p className="text-[11px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
