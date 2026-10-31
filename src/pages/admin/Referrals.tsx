import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { downloadText } from "@/lib/outreach/csv";
import {
  ACTION_LABEL, adminErrorText, allowedActions, disputeReply, monthlyReportCsv, pounds, referralAdmin, reviewLabel,
  type AdminOverview, type AdminReferralRow, type AdminReward, type MonthlyReport, type RewardAction,
} from "@/lib/referral/admin";

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved_awaiting_admin: "default", booked: "secondary", partly_applied: "secondary", applied: "outline",
  rejected: "destructive", reversed: "destructive", clawed_back: "destructive", expired: "outline",
};
const dt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "—");
const NOTIFIABLE: RewardAction[] = ["reject", "reverse", "claw_back"];

function RewardBadge({ r }: { r: AdminReward }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={STATUS_TONE[r.status] ?? "outline"}>{r.role}: {r.status.replace(/_/g, " ")}</Badge>
      {r.hold && <Badge variant="destructive">hold</Badge>}
      {r.needs_review && <Badge variant="outline">review</Badge>}
    </span>
  );
}

export const AdminReferrals = () => {
  const { toast } = useToast();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [filter, setFilter] = useState<"review" | "active" | "credit" | "closed" | "all">("review");
  const [rows, setRows] = useState<AdminReferralRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, l] = await Promise.all([referralAdmin.overview(), referralAdmin.list(filter)]);
      setOverview(o); setRows(l ?? []);
    } catch (e) {
      toast({ title: "Couldn't load referrals", description: String((e as Error).message), variant: "destructive" });
    } finally { setLoading(false); }
  }, [filter, toast]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display uppercase text-3xl">Refer a friend</h1>
          <p className="text-sm text-muted-foreground">
            Bill credit only. Nothing is confirmed to a customer until an admin approves it here. Every action needs a written reason and is logged.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Scheme" value={overview.enabled ? "ON" : "OFF"} note={`Terms ${overview.settings?.terms_version}`} warn={!overview.enabled} />
          <Stat label="Awaiting approval" value={String(overview.awaiting_admin)} />
          <Stat label="Review / hold" value={String(overview.needs_review)} />
          <Stat label="Credit liability" value={pounds(overview.liability_minor)} />
          <Stat label="Goodwill this month" value={`£${Number(overview.goodwill_used_this_month).toFixed(2)}`} note={`Budget £${Number(overview.settings?.goodwill_monthly_budget ?? 0).toFixed(2)}`} />
        </div>
      )}
      {overview?.last_recon && overview.last_recon.issues > 0 && (
        <div className="border-2 border-destructive p-3 text-sm">
          Last reconciliation ({dt(overview.last_recon.created_at)}) found <strong>{overview.last_recon.issues}</strong> issue(s). See Reports.
        </div>
      )}

      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="disputes">Disputes ({overview?.open_disputes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="reports">Reports & reconciliation</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["review", "active", "credit", "closed", "all"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {{ review: "Needs admin", active: "In progress", credit: "Credit booked", closed: "Closed", all: "All" }[f]}
              </Button>
            ))}
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Ref</TableHead><TableHead>Created</TableHead><TableHead>Referrer</TableHead><TableHead>Friend / order</TableHead>
              <TableHead>How</TableHead><TableHead>Rewards</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">Nothing here.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.ref}>
                  <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                  <TableCell className="text-xs">{dt(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.referrer?.account}<br />{r.referrer?.name}</TableCell>
                  <TableCell className="text-xs">{r.friend?.account ?? "—"} {r.friend?.name ?? ""}<br />{r.order_number ?? ""}</TableCell>
                  <TableCell className="text-xs">{r.method}{r.method === "link" && !r.has_click ? " (no click!)" : ""}</TableCell>
                  <TableCell className="space-y-1">{r.rewards?.map((w) => <div key={w.id}><RewardBadge r={w} /></div>)}</TableCell>
                  <TableCell>{r.referral_id && <Button size="sm" variant="outline" onClick={() => setDetailId(r.referral_id)}>Open</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="disputes"><Disputes overview={overview} onChanged={load} /></TabsContent>
        <TabsContent value="reports"><Reports overview={overview} /></TabsContent>
        <TabsContent value="tools"><Tools onChanged={load} /></TabsContent>
      </Tabs>

      {detailId && <ReferralDetail id={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
};

function Stat({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className={`border-2 p-3 ${warn ? "border-destructive" : "border-foreground"}`}>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-2xl">{value}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function ReferralDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const [d, setD] = useState<Record<string, any> | null>(null);
  const [action, setAction] = useState<{ reward: AdminReward & { version: number }; action: RewardAction } | null>(null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD(await referralAdmin.detail(id)); } catch (e) { toast({ title: "Couldn't load", description: String((e as Error).message), variant: "destructive" }); }
  }, [id, toast]);
  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const res = await referralAdmin.act(action.reward.id, action.action, action.reward.version, reason, notify && NOTIFIABLE.includes(action.action));
      if (!res?.ok) { toast({ title: "Not done", description: adminErrorText(res?.error as string), variant: "destructive" }); }
      else { toast({ title: "Done", description: `Status is now ${String(res.status).replace(/_/g, " ")}` }); setAction(null); setReason(""); setNotify(false); onChanged(); void load(); }
    } catch (e) { toast({ title: "Error", description: String((e as Error).message), variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const f = d?.referral; const ev = f?.evidence ?? {};
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Referral {f?.ref}</DialogTitle>
          <DialogDescription>Terms {f?.terms_version} · {f?.attribution_method} · friend type {f?.friend_type}</DialogDescription>
        </DialogHeader>
        {!d ? <p className="text-sm">Loading…</p> : (
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="font-display uppercase">Rewards</h3>
              {(d.rewards ?? []).map((w: any) => {
                const reward: AdminReward = { ...w, hold: w.manual_hold, basis: w.amount_basis };
                return (
                  <div key={w.id} className="mt-2 border-2 border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><RewardBadge r={reward} /> <span className="ml-2">{w.ref} · £{Number(w.amount).toFixed(2)} {w.amount_basis === "net" ? "+VAT" : "incl. VAT"} · balance {pounds(w.balance_minor)}</span></span>
                      <span className="text-xs">v{w.version}</span>
                    </div>
                    {w.status_reason && <p className="mt-1 text-xs">Reason: {w.status_reason}</p>}
                    {w.hold_reason && w.manual_hold && <p className="mt-1 text-xs text-destructive">Hold: {w.hold_reason}</p>}
                    {w.review_reasons?.length > 0 && <p className="mt-1 text-xs">Review: {w.review_reasons.map(reviewLabel).join(" · ")}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {allowedActions(reward).map((a) => (
                        <Button key={a} size="sm" variant={a === "approve" ? "default" : "outline"} onClick={() => { setAction({ reward: { ...reward, version: w.version }, action: a }); setReason(""); setNotify(false); }}>
                          {ACTION_LABEL[a]}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>

            {action && (
              <section className="border-2 border-foreground p-3 space-y-2">
                <p className="font-display uppercase">{ACTION_LABEL[action.action]} — {action.reward.ref}</p>
                {action.action === "approve" && <p className="text-xs">Approving re-runs every check first. If it passes, the credit is booked and the customer is emailed that it's been added.</p>}
                <Label htmlFor="rr-reason">Reason (kept in the audit trail{NOTIFIABLE.includes(action.action) ? "; sent to the customer if you tick below" : ""})</Label>
                <Textarea id="rr-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />
                {NOTIFIABLE.includes(action.action) && (
                  <label className="flex items-center gap-2 text-xs"><Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />Email the customer this reason with the complaints route</label>
                )}
                <div className="flex gap-2">
                  <Button onClick={run} disabled={busy || reason.trim().length < 10}>Confirm</Button>
                  <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
                </div>
              </section>
            )}

            <section>
              <h3 className="font-display uppercase">Attribution evidence</h3>
              <dl className="mt-1 grid grid-cols-[180px_1fr] gap-x-3 gap-y-1 text-xs">
                <dt>Order</dt><dd>{d.order?.number} · created {dt(d.order?.created_at)} · {d.order?.lifecycle} · live {dt(d.order?.live_at)}{d.order?.campaign ? ` · offer ${d.order.campaign}` : ""}</dd>
                <dt>Code</dt><dd>{d.code?.code} · terms shown {d.code?.terms_version} at {dt(d.code?.terms_shown_at)}</dd>
                <dt>Captured</dt><dd>{dt(ev.captured_at)} (link {ev.link_code ?? "—"}, typed {ev.typed_code ?? "—"})</dd>
                <dt>Session</dt><dd>{ev.session_id} · started {dt(ev.session_started_at)} · submitted {dt(ev.session_submitted_at)}</dd>
                <dt>Landing</dt><dd>{ev.landing_path ?? "—"} from {ev.referrer_host ?? "—"}</dd>
                <dt>Click</dt><dd>{d.click ? `${dt(d.click.created_at)} · ${d.click.landing_url ?? ""} · IP match ${ev.click_ip_matches ? "yes" : "no"}` : <span className="text-destructive">No click recorded</span>}</dd>
                <dt>User agent</dt><dd className="break-all">{ev.session_user_agent ?? d.click?.user_agent ?? "—"}</dd>
                <dt>IP hash</dt><dd className="break-all font-mono">{ev.session_ip_hash ?? "—"}</dd>
                {f?.manual_attach_reason && (<><dt>Manual attach</dt><dd>{f.manual_attach_reason}</dd></>)}
              </dl>
            </section>

            <section>
              <h3 className="font-display uppercase">Checks today</h3>
              <ul className="mt-1 text-xs space-y-0.5">
                {Object.entries(d.checks ?? {}).map(([k, v]) => <li key={k}><strong>{k.replace(/_/g, " ")}:</strong> {v == null || (Array.isArray(v) && v.length === 0) ? "clear" : JSON.stringify(v)}</li>)}
              </ul>
              <h4 className="mt-2 text-xs font-bold uppercase">Friend's first bills</h4>
              <ul className="text-xs">
                {(d.friend_invoices ?? []).map((i: any) => <li key={i.invoice_id}>{i.invoice_number} · due {i.due_date} · £{Number(i.owed).toFixed(2)} · paid in full {i.paid_full_on ?? "—"} · {i.on_time ? "on time" : i.paid_unverified ? "marked paid, no receipt" : "not on time / unpaid"}</li>)}
                {(d.friend_invoices ?? []).length === 0 && <li>None yet.</li>}
              </ul>
            </section>

            <section>
              <h3 className="font-display uppercase">Timeline</h3>
              <ol className="mt-1 text-xs space-y-0.5">
                {(d.timeline ?? []).map((e: any) => (
                  <li key={e.id}>{dt(e.created_at)} · <strong>{e.event_type}</strong> {e.from_status ? `${e.from_status} → ` : ""}{e.to_status ?? ""} · {e.actor_kind}{e.reason ? ` · ${e.reason}` : ""}</li>
                ))}
              </ol>
              <h4 className="mt-2 text-xs font-bold uppercase">Credit ledger</h4>
              <ul className="text-xs">
                {(d.ledger ?? []).map((m: any) => <li key={m.id}>{dt(m.created_at)} · {m.kind} {pounds(m.amount_minor)}{m.invoice_id ? ` · invoice ${m.invoice_id}` : ""}{m.reason ? ` · ${m.reason}` : ""}</li>)}
                {(d.ledger ?? []).length === 0 && <li>No credit movements.</li>}
              </ul>
              <h4 className="mt-2 text-xs font-bold uppercase">Customer messages</h4>
              <ul className="text-xs">
                {(d.messages ?? []).map((m: any, i: number) => <li key={i}>{dt(m.created_at)} · {m.template} · {m.status}{m.last_error ? ` (${m.last_error})` : ""}</li>)}
                {(d.messages ?? []).length === 0 && <li>None.</li>}
              </ul>
            </section>

            <section>
              <h3 className="font-display uppercase">Terms snapshot</h3>
              <p className="text-xs">{d.terms?.version} (from {dt(d.terms?.effective_from)}): {d.terms?.summary}</p>
            </section>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Disputes({ overview, onChanged }: { overview: AdminOverview | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState<{ customer: string; referral: string; kind: string; text: string }>({ customer: "", referral: "", kind: "not_tracked", text: "" });
  const [resolve, setResolve] = useState<{ id: string; ref: string; outcome: "upheld" | "rejected" | "goodwill"; text: string; amount: string; customer: string } | null>(null);

  const doOpen = async () => {
    const res = await referralAdmin.dispute("open", { customer: open.customer.trim(), referral: open.referral.trim() || null, kind: open.kind, text: open.text });
    if (!res?.ok) return toast({ title: "Not opened", description: adminErrorText(res?.error as string), variant: "destructive" });
    toast({ title: "Dispute opened" }); setOpen({ customer: "", referral: "", kind: "not_tracked", text: "" }); onChanged();
  };
  const doResolve = async () => {
    if (!resolve) return;
    if (resolve.outcome === "goodwill") {
      const g = await referralAdmin.goodwill(resolve.customer, Number(resolve.amount), resolve.text, resolve.id);
      if (!g?.ok) return toast({ title: "Goodwill not added", description: adminErrorText(g?.error as string), variant: "destructive" });
    }
    const res = await referralAdmin.dispute(resolve.outcome, { dispute: resolve.id, text: resolve.text });
    if (!res?.ok) return toast({ title: "Not resolved", description: adminErrorText(res?.error as string), variant: "destructive" });
    toast({ title: "Dispute resolved", description: "Copy the reply below and send it to the customer." });
    onChanged();
  };

  return (
    <div className="space-y-6">
      <section className="border-2 border-foreground p-3 space-y-2">
        <h3 className="font-display uppercase">Open a dispute</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label>Customer id</Label><Input value={open.customer} onChange={(e) => setOpen({ ...open, customer: e.target.value })} /></div>
          <div><Label>Referral id (optional)</Label><Input value={open.referral} onChange={(e) => setOpen({ ...open, referral: e.target.value })} /></div>
          <div><Label>Type</Label>
            <Select value={open.kind} onValueChange={(v) => setOpen({ ...open, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_tracked">Friend wasn't tracked</SelectItem>
                <SelectItem value="withdrawn">Reward withdrawn / rejected</SelectItem>
                <SelectItem value="amount">Wrong amount</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Label>What the customer says</Label>
        <Textarea value={open.text} onChange={(e) => setOpen({ ...open, text: e.target.value })} rows={2} />
        <Button onClick={doOpen} disabled={open.customer.trim().length < 30 || open.text.trim().length < 10}>Open dispute</Button>
      </section>

      <section>
        <h3 className="font-display uppercase">Open disputes</h3>
        {(overview?.open_disputes ?? []).length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
        {(overview?.open_disputes ?? []).map((d) => (
          <div key={d.id} className="mt-2 border-2 border-border p-3 text-sm">
            <p><strong>{d.ref}</strong> · {d.kind.replace(/_/g, " ")} · {dt(d.created_at)} · customer {d.customer_id}{d.referral_id ? ` · referral ${d.referral_id}` : ""}</p>
            <p className="mt-1">{d.details}</p>
            <div className="mt-2 flex gap-2">
              {(["upheld", "rejected", "goodwill"] as const).map((o) => (
                <Button key={o} size="sm" variant="outline" onClick={() => setResolve({ id: d.id, ref: d.ref, outcome: o, text: "", amount: "10", customer: d.customer_id })}>{o === "upheld" ? "Uphold" : o === "rejected" ? "Reject" : "Goodwill"}</Button>
              ))}
            </div>
            {resolve?.id === d.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <p className="text-xs">Upholding records the outcome; then use the referral's own actions (reinstate, manual attach) to put it right.</p>
                <Label>Written reason</Label>
                <Textarea value={resolve.text} onChange={(e) => setResolve({ ...resolve, text: e.target.value })} rows={2} />
                {resolve.outcome === "goodwill" && (<div className="max-w-[160px]"><Label>Goodwill £</Label><Input type="number" min="0.01" max="100" step="0.01" value={resolve.amount} onChange={(e) => setResolve({ ...resolve, amount: e.target.value })} /></div>)}
                <Button size="sm" onClick={doResolve} disabled={resolve.text.trim().length < 10}>Confirm {resolve.outcome}</Button>
                {resolve.text.trim().length >= 10 && (
                  <div>
                    <Label>Reply to send</Label>
                    <Textarea readOnly rows={9} value={disputeReply(resolve.outcome, d.ref, resolve.text)} />
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => void navigator.clipboard.writeText(disputeReply(resolve.outcome, d.ref, resolve.text))}><Copy className="h-4 w-4 mr-1" />Copy reply</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function Reports({ overview }: { overview: AdminOverview | null }) {
  const { toast } = useToast();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [dry, setDry] = useState<Record<string, any> | null>(null);
  const run = async () => {
    try { setReport(await referralAdmin.monthly(`${month}-01`)); } catch (e) { toast({ title: "Report failed", description: String((e as Error).message), variant: "destructive" }); }
  };
  return (
    <div className="space-y-6 text-sm">
      <section className="space-y-2">
        <h3 className="font-display uppercase">Monthly report</h3>
        <div className="flex items-end gap-2">
          <div><Label>Month</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <Button onClick={run}>Run</Button>
          {report && <Button variant="outline" onClick={() => downloadText(`occta-referrals-${report.month}.csv`, monthlyReportCsv(report))}><Download className="h-4 w-4 mr-1" />CSV</Button>}
        </div>
        {report && (
          <Table>
            <TableBody>
              {[
                ["Credit booked", pounds(report.minor.booked)], ["Credit applied to bills", pounds(report.minor.applied)],
                ["Returned from cancelled bills", pounds(report.minor.unapplied)], ["Expired", pounds(report.minor.expired)],
                ["Reversed", pounds(report.minor.reversed)], ["Clawed back", pounds(report.minor.clawed_back)],
                ["Outstanding liability at month end", pounds(report.liability_minor_at_month_end)],
                ["Customers acquired (reward booked)", String(report.customers_acquired)],
                ["Cost per acquired customer", pounds(report.cost_per_acquired_customer_minor)],
                ["Goodwill booked", pounds(report.goodwill_booked_minor)],
                ["Waiting for review now", String(report.awaiting_review_now)], ["Open disputes now", String(report.open_disputes_now)],
              ].map(([k, v]) => <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{v}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h3 className="font-display uppercase">Nightly reconciliation</h3>
        {overview?.last_recon ? (
          <>
            <p>Last run {dt(overview.last_recon.created_at)}: <strong>{overview.last_recon.issues}</strong> issue(s).</p>
            {overview.last_recon.issues > 0 && <pre className="mt-2 max-h-64 overflow-auto bg-muted p-2 text-xs">{JSON.stringify(overview.last_recon.findings, null, 2)}</pre>}
          </>
        ) : <p>Not run yet.</p>}
        <p className="mt-2 text-xs text-muted-foreground">Checks every booked credit against invoice lines, credit on unpaid bills, orphan credit lines and invoice totals. Messages outbox: {JSON.stringify(overview?.outbox ?? {})}</p>
        {(overview?.binding_errors ?? []).length > 0 && (
          <div className="mt-2"><p className="font-bold text-xs uppercase">Recent binding errors (orders were never blocked)</p>
            <ul className="text-xs">{overview!.binding_errors.map((b) => <li key={b.id}>{dt(b.created_at)} · {b.order_id ?? "—"} · {b.error}</li>)}</ul>
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display uppercase">Go-live dry run</h3>
        <p className="text-xs text-muted-foreground">Read-only: shows which customers could get a code today and confirms no rewards exist.</p>
        <Button size="sm" variant="outline" className="mt-1" onClick={async () => { try { setDry(await referralAdmin.dryRun()); } catch (e) { toast({ title: "Dry run failed", description: String((e as Error).message), variant: "destructive" }); } }}>Run dry run</Button>
        {dry && (
          <div className="mt-2 text-xs">
            <p>Scheme {dry.rewards_enabled ? "ON" : "OFF"} · terms {dry.terms_version} · codes {dry.codes} · referrals {dry.referrals} · rewards {JSON.stringify(dry.rewards_by_status)}</p>
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Live</TableHead><TableHead>Payment issue (12m)</TableHead><TableHead>Code today?</TableHead></TableRow></TableHeader>
              <TableBody>{(dry.customers ?? []).map((c: any) => (
                <TableRow key={c.account ?? Math.random()}><TableCell>{c.account}</TableCell><TableCell>{c.type}</TableCell><TableCell>{c.live ? "yes" : "no"}</TableCell><TableCell>{c.payment_issue_last_12m ?? "none"}</TableCell><TableCell>{c.could_get_code_today ? "yes" : "no"}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tools({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const [attach, setAttach] = useState({ order: "", code: "", reason: "" });
  const [gw, setGw] = useState({ customer: "", amount: "10", reason: "" });
  const [st, setSt] = useState({ customer: "", kind: "payment_arrangement", at: "", note: "" });
  const done = (res: { ok?: boolean; error?: string } | null, ok: string) => {
    if (!res?.ok) { toast({ title: "Not done", description: adminErrorText(res?.error), variant: "destructive" }); return false; }
    toast({ title: ok }); onChanged(); return true;
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3 text-sm">
      <section className="border-2 border-foreground p-3 space-y-2">
        <h3 className="font-display uppercase">Add a code to an order</h3>
        <p className="text-xs text-muted-foreground">Only within 7 days of the order, with a reason. Always goes to review.</p>
        <Label>Order id</Label><Input value={attach.order} onChange={(e) => setAttach({ ...attach, order: e.target.value })} />
        <Label>Referral code</Label><Input value={attach.code} onChange={(e) => setAttach({ ...attach, code: e.target.value.toUpperCase() })} />
        <Label>Reason</Label><Textarea rows={2} value={attach.reason} onChange={(e) => setAttach({ ...attach, reason: e.target.value })} />
        <Button disabled={attach.reason.trim().length < 10 || !attach.order || !attach.code}
          onClick={async () => { if (done(await referralAdmin.manualAttach(attach.order.trim(), attach.code.trim(), attach.reason), "Code attached")) setAttach({ order: "", code: "", reason: "" }); }}>Attach</Button>
      </section>
      <section className="border-2 border-foreground p-3 space-y-2">
        <h3 className="font-display uppercase">Goodwill credit</h3>
        <p className="text-xs text-muted-foreground">Separate from referrals. Counts against the monthly budget. The customer is emailed.</p>
        <Label>Customer id</Label><Input value={gw.customer} onChange={(e) => setGw({ ...gw, customer: e.target.value })} />
        <Label>Amount £ (incl. VAT)</Label><Input type="number" min="0.01" max="100" step="0.01" value={gw.amount} onChange={(e) => setGw({ ...gw, amount: e.target.value })} />
        <Label>Reason</Label><Textarea rows={2} value={gw.reason} onChange={(e) => setGw({ ...gw, reason: e.target.value })} />
        <Button disabled={gw.reason.trim().length < 10 || !gw.customer}
          onClick={async () => { if (done(await referralAdmin.goodwill(gw.customer.trim(), Number(gw.amount), gw.reason), "Goodwill booked")) setGw({ customer: "", amount: "10", reason: "" }); }}>Book goodwill</Button>
      </section>
      <section className="border-2 border-foreground p-3 space-y-2">
        <h3 className="font-display uppercase">Record account history</h3>
        <p className="text-xs text-muted-foreground">For things the billing tables can't see (payment plans, bank recalls, porting away). A returned DD or bank recall puts the friend's referral rewards on hold.</p>
        <Label>Customer id</Label><Input value={st.customer} onChange={(e) => setSt({ ...st, customer: e.target.value })} />
        <Label>Event</Label>
        <Select value={st.kind} onValueChange={(v) => setSt({ ...st, kind: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["payment_arrangement", "bank_recall", "dd_returned", "manual_arrears", "leaving_request", "suspended"].map((k) => <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label>When (optional)</Label><Input type="datetime-local" value={st.at} onChange={(e) => setSt({ ...st, at: e.target.value })} />
        <Label>Note</Label><Textarea rows={2} value={st.note} onChange={(e) => setSt({ ...st, note: e.target.value })} />
        <Button disabled={st.note.trim().length < 10 || !st.customer}
          onClick={async () => { if (done(await referralAdmin.recordStanding(st.customer.trim(), st.kind, st.at ? new Date(st.at).toISOString() : null, st.note), "Recorded")) setSt({ customer: "", kind: "payment_arrangement", at: "", note: "" }); }}>Record</Button>
      </section>
    </div>
  );
}
