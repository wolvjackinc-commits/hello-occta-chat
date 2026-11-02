import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  careApi, sha256HexBrowser, CARE_LETTER_LABEL, CARE_REASON_TEXT, CARE_REQUEST_KINDS, CARE_STATUS_TEXT, type CareMyOverview,
} from "@/lib/care/api";
import { CARE_PLANS, carePlan, carePriceMinor, pounds } from "../../../../supabase/functions/_shared/careTerms.ts";

const d = (v?: string | null) => (v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const per = (f: string) => (f === "monthly" ? "a month" : f === "quarterly" ? "every 3 months" : "a year");
const LIVE = ["pending_review", "pending_mandate", "active", "paused", "cancel_pending"];

const NEEDS = [
  ["large_print", "Large print letters"], ["braille", "Braille letters"], ["carer_copy", "Copy letters to someone who helps me"],
  ["extra_time", "More time on calls"], ["phone_preferred", "I prefer phone calls"], ["email_preferred", "I prefer email"], ["no_sales_contact", "No offers, please"],
] as const;

export default function CareTab() {
  const { toast } = useToast();
  const [o, setO] = useState<CareMyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpKind, setHelpKind] = useState("help");
  const [helpText, setHelpText] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [planAgree, setPlanAgree] = useState(false);
  const [needsOpen, setNeedsOpen] = useState(false);
  const [needs, setNeeds] = useState<string[]>([]);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setO(await careApi.myOverview()); } catch (e) { toast({ title: "Couldn't load OCCTA Care", description: String((e as Error).message), variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !o) return <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading OCCTA Care…</p>;
  const s = o?.subscription ?? null;
  const live = !!s && LIVE.includes(s.status);

  async function doCancel() {
    setBusy(true);
    try {
      const r = await careApi.cancel(cancelReason || null);
      if (!r.ok) throw new Error(r.error ?? "cancel_failed");
      toast({
        title: "OCCTA Care cancelled",
        description: r.status === "cancel_pending" ? `You can use Care until ${d(r.effective_date)}. We've sent confirmation by email and post.` : `We've sent confirmation by email and post.${r.refund_minor ? ` A refund of ${pounds(r.refund_minor)} is on its way.` : ""}`,
      });
      setCancelOpen(false); setCancelReason(""); await load();
    } catch (e) { toast({ title: "Couldn't cancel online", description: `${(e as Error).message}. Please call 0800 260 6626 and we'll do it for you.`, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function doHelp() {
    setBusy(true);
    try {
      const r = await careApi.request(helpKind, helpText);
      if (!r.ok) throw new Error(r.error ?? "request_failed");
      toast({ title: "Request sent", description: "Our team will be in touch. You can follow it in Support → Tickets." });
      setHelpOpen(false); setHelpText(""); await load();
    } catch (e) { toast({ title: "Couldn't send that", description: String((e as Error).message), variant: "destructive" }); }
    finally { setBusy(false); }
  }

  const otherPlan = s ? CARE_PLANS.find((p) => p.code !== s.plan_code)! : null;
  const otherPrice = s && otherPlan ? carePriceMinor(otherPlan.code, s.frequency) ?? 0 : 0;
  const planFacts = s && otherPlan ? [
    `New plan: ${otherPlan.name} at ${pounds(otherPrice)} ${per(s.frequency)}, VAT included.`,
    "The new price is collected from your next payment that's at least 10 working days away. We'll confirm the date in writing.",
    "No minimum term and no exit fee. OCCTA Care is a support service, not insurance.",
  ] : [];

  async function doChangePlan() {
    if (!otherPlan) return;
    setBusy(true);
    try {
      const sha = await sha256HexBrowser(JSON.stringify(planFacts));
      const r = await careApi.changePlan(otherPlan.code, planFacts, sha);
      if (!r.ok) throw new Error(r.error ?? "change_failed");
      toast({ title: `Moved to ${otherPlan.name}`, description: r.effective_date ? `New price from ${d(r.effective_date)}. We've written to confirm.` : "We've written to confirm." });
      setPlanOpen(false); setPlanAgree(false); await load();
    } catch (e) { toast({ title: "Couldn't change plan", description: String((e as Error).message), variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function doNeeds() {
    setBusy(true);
    try {
      const r = await careApi.updateSupportNeeds(needs, needsConsent);
      if (!r.ok) throw new Error(r.error ?? "save_failed");
      toast({ title: needs.length ? "Saved" : "Removed" });
      setNeedsOpen(false); await load();
    } catch (e) { toast({ title: "Couldn't save", description: String((e as Error).message), variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function openLetter(path: string) {
    try { window.open(await careApi.letterUrl(path), "_blank", "noopener"); }
    catch (e) { toast({ title: "Couldn't open the letter", description: String((e as Error).message), variant: "destructive" }); }
  }

  if (!live) {
    const elig = o?.eligibility;
    return (
      <div className="space-y-4" data-testid="care-tab-join">
        <div className="border-[3px] border-foreground p-5">
          <p className="font-display text-2xl uppercase">OCCTA Care</p>
          <p className="mt-2 max-w-2xl text-sm">Our UK team on call for your Wi-Fi, phones, tablets and computers, faster swaps of faulty OCCTA kit and member repair prices. From £4.99 a month. Nothing taken for 14 days, cancel any time. A support service, not insurance.</p>
          {s && <p className="mt-3 text-sm text-muted-foreground">Your last Care ({s.reference}) is {CARE_STATUS_TEXT[s.status]?.toLowerCase() ?? s.status}.</p>}
          {elig && !elig.eligible ? (
            <ul className="mt-3 list-disc pl-5 text-sm">{elig.reasons.map((r) => <li key={r}>{CARE_REASON_TEXT[r] ?? r}</li>)}</ul>
          ) : (
            <div className="mt-4 flex gap-2"><Button asChild><Link to="/care/join">Join OCCTA Care</Link></Button><Button asChild variant="outline"><Link to="/care">Find out more</Link></Button></div>
          )}
        </div>
        {(o?.letters?.length ?? 0) > 0 && <Letters o={o!} onOpen={openLetter} />}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="care-tab-member">
      <div className="border-[3px] border-foreground p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl uppercase">{carePlan(s!.plan_code)?.name}</p>
            <p className="text-sm text-muted-foreground">{s!.reference} · {pounds(s!.price_minor)} {per(s!.frequency)}, VAT included</p>
          </div>
          <Badge variant={s!.status === "active" ? "default" : s!.status === "paused" ? "destructive" : "secondary"}>{CARE_STATUS_TEXT[s!.status] ?? s!.status}</Badge>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Next payment</dt><dd>{o?.next_payment ? `${pounds(o.next_payment.amount_minor)} on or just after ${d(o.next_payment.due_date)}` : "None scheduled"}</dd></div>
          <div><dt className="text-muted-foreground">Cooling-off</dt><dd>{new Date(s!.cooling_off_ends_at) > new Date() ? `Until ${d(s!.cooling_off_ends_at)}: cancel before then and you pay nothing` : "Ended"}</dd></div>
          <div><dt className="text-muted-foreground">Direct Debit</dt><dd>{s!.mandate ? `${s!.mandate.holder}, account ending ${s!.mandate.last4} (${s!.mandate.status === "active" ? "active" : "being set up"})` : "—"}</dd></div>
          {s!.status === "cancel_pending" && <div><dt className="text-muted-foreground">Ends</dt><dd>{d(s!.cancel_effective_date)}</dd></div>}
        </dl>
        {s!.status === "paused" && <p className="mt-3 border-l-4 border-destructive pl-3 text-sm">Care is paused and no payments are being taken. Nothing is owed. Call us if you'd like to restart it.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {["active", "pending_mandate", "pending_review", "cancel_pending"].includes(s!.status) && <Button onClick={() => setHelpOpen(true)} data-testid="care-get-help">Get help</Button>}
          {["active", "pending_mandate"].includes(s!.status) && otherPlan && <Button variant="outline" onClick={() => setPlanOpen(true)}>Switch to {otherPlan.name}</Button>}
          <Button variant="outline" onClick={() => { setNeeds(o?.support_needs?.needs ?? []); setNeedsConsent(false); setNeedsOpen(true); }}>Support needs</Button>
          {s!.status !== "cancel_pending" && <Button variant="outline" onClick={() => setCancelOpen(true)} data-testid="care-cancel">Cancel Care</Button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-[3px] border-foreground p-4">
          <p className="font-display uppercase">Payments</p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {(o?.payments ?? []).map((p) => (
                <tr key={`${p.due_date}-${p.amount_minor}-${p.status}`} className="border-t">
                  <td className="py-1.5">{d(p.due_date)}</td><td>{pounds(p.amount_minor)}</td>
                  <td className="text-xs text-muted-foreground">{{ scheduled: "Scheduled", submitted: "Requested from bank", paid: "Paid", unpaid: "Returned by bank", indemnity_claimed: "Refunded by bank" }[p.status] ?? p.status}</td>
                </tr>
              ))}
              {(o?.payments ?? []).length === 0 && <tr><td className="py-2 text-muted-foreground">No payments yet.</td></tr>}
            </tbody>
          </table>
          {(o?.refunds ?? []).map((f, i) => <p key={i} className="mt-2 text-xs">Refund {pounds(f.amount_minor)}: {f.status === "paid" ? `sent ${d(f.paid_at)}` : "on its way"}</p>)}
        </section>
        <Letters o={o!} onOpen={openLetter} />
      </div>

      <section className="border-[3px] border-foreground p-4">
        <p className="font-display uppercase">What you've used</p>
        {(o?.usage ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Use Get help whenever you need us.</p> : (
          <ul className="mt-2 space-y-1 text-sm">{o!.usage!.map((u, i) => <li key={i}>{d(u.occurred_at)}: {u.kind.replace(/_/g, " ")}</li>)}</ul>
        )}
      </section>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel OCCTA Care?</DialogTitle>
            <DialogDescription>No exit fee. {s!.frequency === "monthly" ? "No more payments will be taken; you can use Care until the end of the month you've paid for." : "We'll refund the unused part of what you've paid, by bank transfer within 14 days."} Your broadband and other services aren't affected.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="why">Anything you'd like to tell us? (optional)</Label>
          <Textarea id="why" maxLength={1000} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Care</Button>
            <Button variant="destructive" onClick={() => void doCancel()} disabled={busy} data-testid="care-cancel-confirm">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, cancel Care</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Get help</DialogTitle><DialogDescription>Tell us what's going on. For anything urgent, call 0800 260 6626.</DialogDescription></DialogHeader>
          <Select value={helpKind} onValueChange={setHelpKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CARE_REQUEST_KINDS.filter((k) => s!.plan_code === "plus" || !["health_check", "extender"].includes(k.code)).map((k) => <SelectItem key={k.code} value={k.code}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea maxLength={2000} placeholder="What do you need help with?" value={helpText} onChange={(e) => setHelpText(e.target.value)} />
          {helpKind === "repair_quote" && <p className="text-xs text-muted-foreground">We'll get you a fixed member price first. Repairs are optional and paid by you, per repair. Care doesn't pay for device repairs.</p>}
          <DialogFooter><Button onClick={() => void doHelp()} disabled={busy || helpText.trim().length < 3}>Send</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Switch to {otherPlan?.name}</DialogTitle><DialogDescription>Key facts for the change:</DialogDescription></DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">{planFacts.map((f) => <li key={f}>{f}</li>)}</ul>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={planAgree} onCheckedChange={(v) => setPlanAgree(v === true)} /> <span>I agree to switch plan on these terms.</span></label>
          <DialogFooter><Button onClick={() => void doChangePlan()} disabled={busy || !planAgree}>Switch plan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={needsOpen} onOpenChange={setNeedsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Support needs</DialogTitle><DialogDescription>Tell us what helps. Untick everything and save to remove it.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {NEEDS.map(([code, label]) => (
              <label key={code} className="flex items-center gap-2 text-sm"><Checkbox checked={needs.includes(code)} onCheckedChange={(v) => setNeeds((c) => v === true ? [...c, code] : c.filter((x) => x !== code))} /> {label}</label>
            ))}
          </div>
          {needs.length > 0 && <label className="flex items-start gap-2 text-sm"><Checkbox checked={needsConsent} onCheckedChange={(v) => setNeedsConsent(v === true)} /> <span>I'm happy for OCCTA to record this so they can support me.</span></label>}
          <DialogFooter><Button onClick={() => void doNeeds()} disabled={busy || (needs.length > 0 && !needsConsent)}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Letters({ o, onOpen }: { o: CareMyOverview; onOpen: (path: string) => void }) {
  return (
    <section className="border-[3px] border-foreground p-4">
      <p className="font-display uppercase">Your letters</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {(o.letters ?? []).map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2">
            <span>{d(l.created_at)}: {CARE_LETTER_LABEL[l.type] ?? l.type}</span>
            {l.pdf_path && <Button size="sm" variant="outline" onClick={() => onOpen(l.pdf_path!)}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button>}
          </li>
        ))}
        {(o.letters ?? []).length === 0 && <li className="text-muted-foreground">Your letters will appear here.</li>}
      </ul>
    </section>
  );
}
