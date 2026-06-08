import { useEffect, useState } from "react";
import { Gift, Users, Award, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useToast } from "@/hooks/use-toast";

type Account = { points_balance: number; bill_credit_balance: number; status: string } | null;
type Code = { code: string; status: string; usage_count: number; expires_at: string | null };
type Ledger = { id: string; source_type: string; points_delta: number; bill_credit_delta: number; status: string; reason: string; created_at: string };
type Benefit = { id: string; benefit_name: string; description: string | null; value_label: string | null; terms_text: string | null; plan_type: string; customer_type: string };

export function RewardsTab() {
  const { rewardsEnabled, isLoading: settingsLoading } = usePlatformSettings();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [account, setAccount] = useState<Account>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);

  async function loadAll() {
    setLoading(true);
    try {
      const [acc, cods, led, ben] = await Promise.all([
        (supabase as any).rpc("get_customer_reward_account"),
        (supabase as any).rpc("get_customer_referral_codes"),
        (supabase as any).rpc("get_customer_points_ledger", { _limit: 20 }),
        (supabase as any).rpc("get_public_contract_benefits"),
      ]);
      setAccount((acc.data?.[0] ?? null) as Account);
      setCodes((cods.data ?? []) as Code[]);
      setLedger((led.data ?? []) as Ledger[]);
      setBenefits((ben.data ?? []) as Benefit[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (rewardsEnabled) loadAll();
    else setLoading(false);
  }, [rewardsEnabled]);

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

  if (!rewardsEnabled) {
    return (
      <div className="space-y-4">
        <div className="p-4 border-4 border-foreground bg-primary/10">
          <p className="font-display uppercase">OCCTA Rewards is coming soon</p>
          <p className="text-sm text-muted-foreground mt-1">
            Final reward values, eligibility and unlock rules will be shown before activation.
          </p>
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
      {/* Balances */}
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

      {/* Referral */}
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

      {/* Benefits */}
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

      {/* Recent activity */}
      <div className="p-4 border-2 border-foreground">
        <p className="font-display uppercase mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Recent activity</p>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewards activity yet.</p>
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