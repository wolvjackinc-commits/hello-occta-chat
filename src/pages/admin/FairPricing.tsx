import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type FP = any;

const DEFAULTS: FP = {
  enabled: true,
  priceLockEnabled: true,
  flex30Enabled: true,
  headline: {
    essential: { lock24: 29.99, flex30: 32.99 },
    superfast: { lock24: 34.99, flex30: 37.99 },
    ultrafast: { lock24: 39.99, flex30: 44.99 },
    gigabit:   { lock24: 44.99, flex30: 49.99 },
  },
  router: { standardOneOff: 79.99, standardMonthly: 4.99, premiumOneOff: 129.99, premiumMonthly: 7.99 },
  setup:  { remote: 0, standard: 49.99, engineer: 99.99 },
  addons: { priorityMonthly: 6.99, staticIpMonthly: 5.00, digitalVoiceMonthly: 5.99, paperBillingMonthly: 2.50 },
  buffers: { support: 1.00, paymentFailure: 0.50, lockRisk: 1.00, flexRisk: 2.00, rewards: 0.00 },
  floors:  { essentialLockByo: 1.50, essentialFlex: 3.50, superfast: 3.50, ultrafast: 4.50, gigabit: 4.50 },
  fallback: "auto_bump",
};

export function AdminFairPricing() {
  const { toast } = useToast();
  const [fp, setFp] = useState<FP>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("platform_settings").select("fair_pricing").eq("singleton", true).maybeSingle();
      if (data?.fair_pricing && Object.keys(data.fair_pricing).length) setFp({ ...DEFAULTS, ...data.fair_pricing });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("platform_settings").update({ fair_pricing: fp }).eq("singleton", true);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Fair pricing saved" });
  };

  if (loading) return <div className="p-6 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  const num = (path: string[], val: any) => {
    setFp((prev: FP) => {
      const next = JSON.parse(JSON.stringify(prev));
      let o = next; for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] ?? {};
      o[path[path.length - 1]] = Number(val);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Fair Pricing</h1>
        <p className="text-sm text-muted-foreground mt-1">Headline prices, router/setup/add-ons, buffers and margin floors used by the Build Your Plan resolver.</p>
      </header>

      <Section title="Flags">
        <Toggle label="Price Lock 24 enabled" checked={!!fp.priceLockEnabled} onChange={(v) => setFp({ ...fp, priceLockEnabled: v })} />
        <Toggle label="Flex 30 enabled" checked={!!fp.flex30Enabled} onChange={(v) => setFp({ ...fp, flex30Enabled: v })} />
        <div className="flex items-center gap-3">
          <Label className="w-48">Fallback behaviour</Label>
          <select value={fp.fallback ?? "auto_bump"} onChange={(e) => setFp({ ...fp, fallback: e.target.value })} className="border-2 border-foreground p-2 bg-background">
            <option value="auto_bump">Auto-bump to next safe price</option>
            <option value="quote_only">Quote-only fallback</option>
          </select>
        </div>
      </Section>

      <Section title="Headline monthly prices (incl. VAT)">
        {(["essential","superfast","ultrafast","gigabit"] as const).map((b) => (
          <div key={b} className="grid grid-cols-3 gap-3 items-center">
            <Label className="capitalize">{b}</Label>
            <Field label="Price Lock 24 £" value={fp.headline?.[b]?.lock24} onChange={(v) => num(["headline", b, "lock24"], v)} />
            <Field label="Flex 30 £" value={fp.headline?.[b]?.flex30} onChange={(v) => num(["headline", b, "flex30"], v)} />
          </div>
        ))}
      </Section>

      <Section title="Router">
        <Field label="Standard one-off £" value={fp.router?.standardOneOff} onChange={(v) => num(["router","standardOneOff"], v)} />
        <Field label="Standard monthly £" value={fp.router?.standardMonthly} onChange={(v) => num(["router","standardMonthly"], v)} />
        <Field label="Premium one-off £" value={fp.router?.premiumOneOff} onChange={(v) => num(["router","premiumOneOff"], v)} />
        <Field label="Premium monthly £" value={fp.router?.premiumMonthly} onChange={(v) => num(["router","premiumMonthly"], v)} />
      </Section>

      <Section title="Setup">
        <Field label="Remote £" value={fp.setup?.remote} onChange={(v) => num(["setup","remote"], v)} />
        <Field label="Standard £" value={fp.setup?.standard} onChange={(v) => num(["setup","standard"], v)} />
        <Field label="Engineer £" value={fp.setup?.engineer} onChange={(v) => num(["setup","engineer"], v)} />
      </Section>

      <Section title="Add-ons (monthly)">
        <Field label="Priority support £" value={fp.addons?.priorityMonthly} onChange={(v) => num(["addons","priorityMonthly"], v)} />
        <Field label="Static IP £" value={fp.addons?.staticIpMonthly} onChange={(v) => num(["addons","staticIpMonthly"], v)} />
        <Field label="Digital Voice £" value={fp.addons?.digitalVoiceMonthly} onChange={(v) => num(["addons","digitalVoiceMonthly"], v)} />
        <Field label="Paper billing £" value={fp.addons?.paperBillingMonthly} onChange={(v) => num(["addons","paperBillingMonthly"], v)} />
      </Section>

      <Section title="Buffers (margin)">
        <Field label="Support £" value={fp.buffers?.support} onChange={(v) => num(["buffers","support"], v)} />
        <Field label="Payment failure £" value={fp.buffers?.paymentFailure} onChange={(v) => num(["buffers","paymentFailure"], v)} />
        <Field label="Price Lock risk £" value={fp.buffers?.lockRisk} onChange={(v) => num(["buffers","lockRisk"], v)} />
        <Field label="Flex 30 risk £" value={fp.buffers?.flexRisk} onChange={(v) => num(["buffers","flexRisk"], v)} />
        <Field label="Rewards £" value={fp.buffers?.rewards} onChange={(v) => num(["buffers","rewards"], v)} />
      </Section>

      <Section title="Margin floors (per month)">
        <Field label="Essential / Lock + BYO £" value={fp.floors?.essentialLockByo} onChange={(v) => num(["floors","essentialLockByo"], v)} />
        <Field label="Essential / Flex £" value={fp.floors?.essentialFlex} onChange={(v) => num(["floors","essentialFlex"], v)} />
        <Field label="Superfast £" value={fp.floors?.superfast} onChange={(v) => num(["floors","superfast"], v)} />
        <Field label="Ultrafast £" value={fp.floors?.ultrafast} onChange={(v) => num(["floors","ultrafast"], v)} />
        <Field label="Gigabit £" value={fp.floors?.gigabit} onChange={(v) => num(["floors","gigabit"], v)} />
      </Section>

      <div className="sticky bottom-0 pt-4 bg-background border-t-2 border-foreground/10">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save fair pricing"}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-4 border-foreground p-5 space-y-3">
      <h2 className="font-display uppercase">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-56 text-sm">{label}</Label>
      <Input type="number" step="0.01" value={value ?? 0} onChange={(e) => onChange(e.target.value)} className="max-w-[140px]" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3"><Switch checked={checked} onCheckedChange={onChange} /><Label>{label}</Label></div>
  );
}