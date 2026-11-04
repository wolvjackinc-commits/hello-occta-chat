import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Phone, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dbErrorText } from "@/lib/dbErrorText";
import {
  RECOVERY_OUTCOMES, inView, isCallbackDue, localInputToIso, outcomeLabel, telHref,
  type QueueView, type RecoveryOutcome,
} from "@/lib/journey/recovery";

type Row = {
  session_id: string; customer_name: string | null; phone: string | null; email: string | null; postcode: string | null;
  current_stage: string | null; progress_percent: number | null; status: string; plan_label: string | null;
  contract_signed: boolean; expired: boolean; existing_customer: boolean;
  started_at: string; last_activity_at: string; first_abandoned_at: string | null;
  reminders_sent: number; last_reminder_at: string | null;
  contact_attempts: number; last_outcome: string | null; last_contact_at: string | null; callback_at: string | null;
  opted_out_at: string | null; utm_source: string | null;
};
type Stats = {
  window_days: number; started: number; abandoned: number; recovered: number;
  recovered_after_reminder: number; recovered_after_staff_contact: number; recovered_without_touch: number;
  open_abandoned: number; open_with_phone: number; open_contacted: number; opted_out: number;
  recovery_rate: number | null; outcomes: Record<string, number>;
};
type Contact = { id: string; outcome: string; note: string | null; callback_at: string | null; created_at: string; staff_email: string | null };

const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const stage = (v: string | null) => (v ? v.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Started");

function LogContact({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<RecoveryOutcome | "">("");
  const [note, setNote] = useState("");
  const [callback, setCallback] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Contact[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async () => {
    const { data, error } = await (supabase as any).rpc("admin_checkout_recovery_history", { _session_id: row.session_id });
    if (error) setHistoryError(dbErrorText(error, "Contact history could not be loaded"));
    else { setHistoryError(null); setHistory((data ?? []) as Contact[]); }
  };
  useEffect(() => { void loadHistory(); }, [row.session_id]);

  const save = async () => {
    if (!outcome) return;
    const callbackIso = outcome === "callback_requested" ? localInputToIso(callback) : null;
    if (outcome === "callback_requested" && !callbackIso) {
      toast({ title: "Pick a callback time", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("admin_log_checkout_recovery", {
      _session_id: row.session_id, _outcome: outcome, _note: note.trim() || null, _callback_at: callbackIso,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Not saved", description: dbErrorText(error, "The contact could not be logged"), variant: "destructive" });
      return;
    }
    toast({ title: "Contact logged", description: outcomeLabel(outcome) });
    setOutcome(""); setNote(""); setCallback("");
    await loadHistory();
    onSaved();
  };

  return (
    <div className="border-t-2 border-border p-4 bg-muted/20 grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <h4 className="font-display uppercase tracking-wider text-sm">Log this contact</h4>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome">
          {RECOVERY_OUTCOMES.filter((o) => (row.opted_out_at ? o.value === "opt_out_withdrawn" : o.value !== "opt_out_withdrawn")).map((o) => (
            <Button key={o.value} type="button" size="sm" role="radio" aria-checked={outcome === o.value}
              variant={outcome === o.value ? "default" : "outline"} onClick={() => setOutcome(o.value)}>
              {o.label}
            </Button>
          ))}
        </div>
        {outcome === "callback_requested" && (
          <div>
            <Label htmlFor={`cb-${row.session_id}`}>Call back at (UK time)</Label>
            <Input id={`cb-${row.session_id}`} type="datetime-local" value={callback} onChange={(e) => setCallback(e.target.value)} />
          </div>
        )}
        <div>
          <Label htmlFor={`note-${row.session_id}`}>Note (optional — what stopped them, what they asked)</Label>
          <Textarea id={`note-${row.session_id}`} maxLength={1000} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {outcome === "do_not_contact" && (
          <p className="text-xs text-destructive">Stops all further automatic reminder emails for this checkout.</p>
        )}
        {outcome === "phone_order_started" && (
          <p className="text-xs">Create the order in <Link className="underline" to="/admin/quote-requests">Quote requests → New phone order</Link>, then log it here.</p>
        )}
        <Button type="button" onClick={() => void save()} disabled={!outcome || saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}Save contact
        </Button>
        <p className="text-[11px] text-muted-foreground">Contacts are permanent and can't be edited. They show in the journey timeline below with your login.</p>
      </div>
      <div>
        <h4 className="font-display uppercase tracking-wider text-sm mb-2">Contact history</h4>
        {historyError ? (
          <p className="text-xs text-destructive">{historyError}</p>
        ) : history === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No contact logged yet.</p>
        ) : (
          <ol className="space-y-2 text-xs">
            {history.map((c) => (
              <li key={c.id} className="border-2 border-border p-2">
                <div className="flex justify-between gap-2"><strong>{outcomeLabel(c.outcome)}</strong><time>{fmt(c.created_at)}</time></div>
                <div className="text-muted-foreground">{c.staff_email ?? "Staff user"}{c.callback_at ? ` · callback ${fmt(c.callback_at)}` : ""}</div>
                {c.note && <p className="mt-1 whitespace-pre-wrap break-words">{c.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function CheckoutRecoveryDesk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<QueueView>("todo");
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [q, st] = await Promise.all([
      (supabase as any).rpc("admin_checkout_recovery_queue", { _limit: 300 }),
      (supabase as any).rpc("admin_checkout_recovery_stats", { _days: 30 }),
    ]);
    if (q.error || st.error) {
      // Never show a failed read as an empty queue.
      setError(dbErrorText(q.error ?? st.error, "Recovery desk could not be loaded"));
    } else {
      setError(null);
      setRows((q.data ?? []) as Row[]);
      setStats(st.data as Stats);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const now = Date.now();
  const counts = useMemo(() => ({
    todo: rows.filter((r) => inView(r, "todo", now)).length,
    callbacks: rows.filter((r) => inView(r, "callbacks", now)).length,
    contacted: rows.filter((r) => inView(r, "contacted", now)).length,
    all: rows.length,
  }), [rows, now]);
  const visible = rows.filter((r) => inView(r, view, now));

  return (
    <section className="border-4 border-foreground bg-background p-4 md:p-5 space-y-5" aria-labelledby="recovery-desk-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="recovery-desk-title" className="font-display uppercase text-lg tracking-wide">Checkout recovery desk</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Customers who started an online order, left contact details and didn't finish (last 30 days). Call them, log what happened,
            and the outcome is recorded against the session. Contract-signed checkouts are listed first after due callbacks.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="border-2 border-destructive p-3 text-sm space-y-2">
          <p className="text-destructive"><strong>Recovery desk could not be loaded.</strong> Nothing is shown rather than an empty list.</p>
          <pre className="text-xs whitespace-pre-wrap border-2 border-border p-2">{error}</pre>
        </div>
      )}

      {stats && !error && (
        <>
          <dl className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {([
              ["Abandoned", stats.abandoned],
              ["Recovered", stats.recovered],
              ["Recovery rate", stats.recovery_rate === null ? "—" : `${stats.recovery_rate}%`],
              ["After reminder email", stats.recovered_after_reminder],
              ["After staff call", stats.recovered_after_staff_contact],
              ["Came back unprompted", stats.recovered_without_touch],
              ["Open, phone on file", stats.open_with_phone],
            ] as const).map(([label, v]) => (
              <div key={label} className="border-2 border-border p-3">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
                <dd className="font-display text-2xl mt-1">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Journey 2 sessions started in the last {stats.window_days} days, test sessions excluded ({stats.started} started).
            Recovered = recorded abandoned, then completed. "After reminder" / "after staff call" mean that touch happened before completion —
            a session can count in both, and neither proves the touch caused the order. Do-not-contact: {stats.opted_out}.
          </p>
        </>
      )}

      {!error && (
        <div className="flex flex-wrap gap-2">
          {(["todo", "callbacks", "contacted", "all"] as QueueView[]).map((v) => (
            <Button key={v} type="button" size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>
              {v === "todo" ? "To call" : v === "callbacks" ? "Callbacks" : v === "contacted" ? "Contacted" : "All"} ({counts[v]})
            </Button>
          ))}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Loading recovery queue…</p>
      ) : !error && visible.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nothing in this view.</p>
      ) : !error && (
        <div className="space-y-3">
          {visible.map((r) => {
            const tel = telHref(r.phone);
            const due = isCallbackDue(r, now);
            return (
              <article key={r.session_id} className={`border-2 ${due ? "border-destructive" : "border-border"}`}>
                <div className="p-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate">{r.customer_name || "Name not given"}</strong>
                      {r.contract_signed && <Badge>Contract signed</Badge>}
                      {r.existing_customer && <Badge variant="outline">Already a customer</Badge>}
                      {r.expired && <Badge variant="outline">Link expired</Badge>}
                      {r.opted_out_at && <Badge variant="destructive">Do not contact</Badge>}
                      {due && <Badge variant="destructive">Callback due</Badge>}
                    </div>
                    <div className="text-sm mt-1 flex flex-wrap gap-x-3">
                      {r.phone ? (tel && !r.opted_out_at
                        ? <a className="underline inline-flex items-center gap-1" href={tel}><Phone className="w-3.5 h-3.5" aria-hidden="true" />{r.phone}</a>
                        : <span>{r.phone}</span>) : <span className="text-muted-foreground">No phone</span>}
                      <span className="text-muted-foreground truncate">{r.email ?? "No email"}{r.postcode ? ` · ${r.postcode}` : ""}</span>
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">{stage(r.current_stage)} · {r.progress_percent ?? 0}%</div>
                    <div className="text-muted-foreground">{r.plan_label ?? "Plan not chosen"}</div>
                    <div className="text-muted-foreground">Last active {fmt(r.last_activity_at)}</div>
                  </div>
                  <div className="text-xs">
                    <div>{r.reminders_sent} reminder email{r.reminders_sent === 1 ? "" : "s"}{r.last_reminder_at ? ` · last ${fmt(r.last_reminder_at)}` : ""}</div>
                    <div>{r.contact_attempts} call{r.contact_attempts === 1 ? "" : "s"} · {outcomeLabel(r.last_outcome)}{r.last_contact_at ? ` ${fmt(r.last_contact_at)}` : ""}</div>
                    {r.callback_at && r.last_outcome === "callback_requested" && <div>Callback {fmt(r.callback_at)}</div>}
                  </div>
                  <Button type="button" size="sm" variant={open === r.session_id ? "default" : "outline"}
                    aria-expanded={open === r.session_id} onClick={() => setOpen(open === r.session_id ? null : r.session_id)}>
                    {open === r.session_id ? "Close" : "Log contact"}
                  </Button>
                </div>
                {open === r.session_id && <LogContact row={r} onSaved={() => void load()} />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
