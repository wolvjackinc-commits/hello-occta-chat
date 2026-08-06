import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";

type Settings = {
  customer_journey_v1_enabled: boolean;
  customer_journey_v2_enabled: boolean;
  customer_journey_default: "v1" | "v2";
  customer_journey_v2_kill_switch: boolean;
  customer_journey_v2_test_mode: boolean;
  customer_journey_v2_rollout_percentage: number;
  customer_journey_v2_abandoned_resume_enabled: boolean;
  customer_journey_v2_resume_delay_minutes: number;
  customer_journey_v2_session_expiry_days: number;
  customer_journey_v2_assumed_availability: boolean;
  customer_journey_v2_last_preflight_at: string | null;
  customer_journey_v2_last_preflight_result: { ok?: boolean; checks?: { key: string; label: string; ok: boolean; detail?: string }[]; failures?: string[] } | null;
};

const COLS = `customer_journey_v1_enabled, customer_journey_v2_enabled, customer_journey_default,
  customer_journey_v2_kill_switch, customer_journey_v2_test_mode, customer_journey_v2_rollout_percentage,
  customer_journey_v2_abandoned_resume_enabled, customer_journey_v2_resume_delay_minutes,
  customer_journey_v2_session_expiry_days, customer_journey_v2_assumed_availability,
  customer_journey_v2_last_preflight_at, customer_journey_v2_last_preflight_result`;

export default function AdminJourneyControl() {
  const { toast } = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [counts, setCounts] = useState<{ active: number; completed: number; cancelled: number }>({ active: 0, completed: 0, cancelled: 0 });

  const load = async () => {
    const { data } = await supabase.from("platform_settings").select(COLS).eq("singleton", true).maybeSingle();
    setS((data ?? null) as Settings | null);
    const statuses: [string, "active" | "completed" | "cancelled"][] = [
      ["active", "active"], ["completed", "completed"], ["cancelled", "cancelled"],
    ];
    const next = { active: 0, completed: 0, cancelled: 0 };
    for (const [db, key] of statuses) {
      const { count } = await supabase
        .from("customer_journey_sessions")
        .select("id", { count: "exact", head: true })
        .eq("journey_version", "v2")
        .eq("status", db);
      next[key] = count ?? 0;
    }
    setCounts(next);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const preflightOk = !!s?.customer_journey_v2_last_preflight_result?.ok;

  const update = async (patch: Partial<Settings>, key: string) => {
    if (!s) return;
    // Journey 2 can only become the default once preflight has passed.
    if (patch.customer_journey_default === "v2" && !preflightOk) {
      toast({ title: "Preflight required", description: "Run the Journey 2 preflight and clear all failures first.", variant: "destructive" });
      return;
    }
    setSavingKey(key);
    const { error } = await supabase.from("platform_settings").update(patch).eq("singleton", true);
    setSavingKey(null);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setS({ ...s, ...patch });
    toast({ title: "Saved" });
  };

  const runPreflight = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("journey2-preflight", { body: {} });
    setRunning(false);
    if (error || (data as any)?.error) {
      toast({ title: "Preflight failed to run", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    await load();
    const ok = (data as any)?.result?.ok;
    toast({
      title: ok ? "Preflight passed" : "Preflight found blockers",
      description: ok ? "Journey 2 can be enabled for customers." : `${(data as any)?.result?.failures?.length ?? 0} check(s) failed.`,
      variant: ok ? "default" : "destructive",
    });
  };

  if (loading) {
    return <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }
  if (!s) return <p className="p-6 text-sm text-muted-foreground">Journey settings are unavailable.</p>;

  const checks = s.customer_journey_v2_last_preflight_result?.checks ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      <header>
        <h1 className="font-display uppercase text-2xl">Customer journey control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Journey 1 is the quote-led route. Journey 2 is the immediate online order. Both can run at the same time; switching
          only affects new sessions — customers already mid-journey always finish on the version they started.
        </p>
      </header>

      {s.customer_journey_v2_kill_switch && (
        <div className="border-4 border-destructive p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive mt-0.5" />
          <p className="text-sm">
            <strong>Journey 2 kill switch is on.</strong> All new visitors are routed to Journey 1. In-flight Journey 2 sessions
            are not deleted.
          </p>
        </div>
      )}

      <section className="border-4 border-foreground p-5 space-y-4">
        <h2 className="font-display uppercase text-sm tracking-widest">Availability</h2>

        {[
          { key: "customer_journey_v1_enabled", label: "Journey 1 (quote-led) enabled", value: s.customer_journey_v1_enabled },
          { key: "customer_journey_v2_enabled", label: "Journey 2 (order now) enabled", value: s.customer_journey_v2_enabled },
          { key: "customer_journey_v2_kill_switch", label: "Journey 2 kill switch", value: s.customer_journey_v2_kill_switch },
          { key: "customer_journey_v2_test_mode", label: "Journey 2 test mode (mark new sessions as test)", value: s.customer_journey_v2_test_mode },
          { key: "customer_journey_v2_abandoned_resume_enabled", label: "Send abandoned-session resume emails", value: s.customer_journey_v2_abandoned_resume_enabled },
          { key: "customer_journey_v2_assumed_availability", label: "Assume availability for published speeds", value: s.customer_journey_v2_assumed_availability },
        ].map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0">
            <Label htmlFor={row.key} className="text-sm font-normal">{row.label}</Label>
            <Switch
              id={row.key}
              checked={row.value}
              disabled={savingKey === row.key}
              onCheckedChange={(v) => update({ [row.key]: v } as Partial<Settings>, row.key)}
            />
          </div>
        ))}

        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm font-normal">Default journey for new visitors</Label>
          <div className="flex gap-2">
            {(["v1", "v2"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={s.customer_journey_default === v ? "default" : "outline"}
                disabled={savingKey === "default"}
                onClick={() => update({ customer_journey_default: v }, "default")}
              >
                {v === "v1" ? "Journey 1" : "Journey 2"}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-4 border-foreground p-5 space-y-4">
        <h2 className="font-display uppercase text-sm tracking-widest">Rollout</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="pct">Journey 2 rollout %</Label>
            <Input id="pct" type="number" min={0} max={100} defaultValue={s.customer_journey_v2_rollout_percentage}
              onBlur={(e) => update({ customer_journey_v2_rollout_percentage: Math.max(0, Math.min(100, Number(e.target.value))) }, "pct")} />
          </div>
          <div>
            <Label htmlFor="delay">Resume email delay (minutes)</Label>
            <Input id="delay" type="number" min={5} max={10080} defaultValue={s.customer_journey_v2_resume_delay_minutes}
              onBlur={(e) => update({ customer_journey_v2_resume_delay_minutes: Math.max(5, Number(e.target.value)) }, "delay")} />
          </div>
          <div>
            <Label htmlFor="exp">Session expiry (days)</Label>
            <Input id="exp" type="number" min={1} max={90} defaultValue={s.customer_journey_v2_session_expiry_days}
              onBlur={(e) => update({ customer_journey_v2_session_expiry_days: Math.max(1, Math.min(90, Number(e.target.value))) }, "exp")} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Rollout is deterministic per visitor, so a returning visitor always sees the same journey.
        </p>
      </section>

      <section className="border-4 border-foreground p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display uppercase text-sm tracking-widest">Production preflight</h2>
          <div className="flex items-center gap-3">
            <Badge variant={preflightOk ? "default" : "destructive"}>{preflightOk ? "Passed" : "Not passed"}</Badge>
            <Button size="sm" onClick={runPreflight} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Run preflight</span>
            </Button>
          </div>
        </div>
        {s.customer_journey_v2_last_preflight_at && (
          <p className="text-xs text-muted-foreground">
            Last run {new Date(s.customer_journey_v2_last_preflight_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
          </p>
        )}
        {checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No preflight has been run yet. Journey 2 cannot be made the default until it passes.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.key} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
                <span>{c.label}{c.detail ? <span className="text-muted-foreground"> · {c.detail}</span> : null}</span>
                <Badge variant={c.ok ? "outline" : "destructive"}>{c.ok ? "OK" : "Blocked"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-4 border-foreground p-5">
        <h2 className="font-display uppercase text-sm tracking-widest mb-3">Journey 2 sessions</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          {([["Active", counts.active], ["Completed", counts.completed], ["Cancelled", counts.cancelled]] as const).map(([label, v]) => (
            <div key={label} className="border-2 border-border p-3">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
              <dd className="font-display text-2xl">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}