import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerPicker } from "@/components/admin/CustomerPicker";
import { downloadText, toCsv } from "@/lib/outreach/csv";
import { careAdmin, dd, dt, gbp, today, type Json } from "@/lib/care/admin";
import { careAdminFn, CARE_LETTER_LABEL } from "@/lib/care/api";
import { CARE_FREQUENCIES, CARE_PHONE_SCRIPT, CARE_PLANS, carePriceMinor, pounds } from "../../../../supabase/functions/_shared/careTerms.ts";
import { openStoragePath, useCareAction } from "./MemberDialog";

// ------------------------------------------------------------------ Disputes
export function DisputesPanel({ onOpenMember, onChanged }: { onOpenMember: (id: string) => void; onChanged: () => void }) {
  const [rows, setRows] = useState<Json[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const load = useCallback(async () => setRows((await careAdmin.disputes()) ?? []), []);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  const { busy, run } = useCareAction(() => { void load(); onChanged(); });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Indemnity claims: challenge only when the evidence pack shows every rule was followed (agreement, 10 working days' notice, right amount and date, mandate not cancelled). Otherwise accept: it costs less than the argument. Never re-collect without a new mandate.</p>
      <Table>
        <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Received</TableHead><TableHead>Respond by</TableHead><TableHead>Status</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">No disputes.</TableCell></TableRow>}
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="text-xs">{d.kind.replace(/_/g, " ")} {d.bacs_reason_code ? `(${d.bacs_reason_code})` : ""}</TableCell>
              <TableCell><button className="font-mono text-xs underline" onClick={() => onOpenMember(d.subscription_id)}>{d.reference}</button><br /><span className="text-xs">{d.full_name}</span></TableCell>
              <TableCell>{d.amount_minor ? gbp(d.amount_minor) : "—"}</TableCell>
              <TableCell className="text-xs">{dd(d.received_on)}</TableCell>
              <TableCell className={`text-xs ${d.status === "open" && d.days_left <= 2 ? "font-bold text-destructive" : ""}`}>{dd(d.respond_by)}{d.status === "open" ? ` (${d.days_left}d)` : ""}</TableCell>
              <TableCell><Badge variant={d.status === "open" ? "destructive" : "outline"}>{d.status}</Badge></TableCell>
              <TableCell className="min-w-[260px]">
                {d.status === "open" && d.kind === "indemnity_claim" ? (
                  <div className="space-y-1">
                    <Button size="sm" variant="outline" disabled={busy} onClick={async () => { const r = await run("Evidence pack created", () => careAdminFn.evidencePack(d.subscription_id, "indemnity_challenge", d.id)); if (r?.url) window.open(String(r.url), "_blank", "noopener"); }}><FileText className="mr-1 h-3.5 w-3.5" />Evidence pack</Button>
                    <Input placeholder="Decision note (10+ characters)" value={note[d.id] ?? ""} onChange={(e) => setNote({ ...note, [d.id]: e.target.value })} />
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" disabled={busy || !d.evidence_pack_id} onClick={() => run("Challenge recorded: submit it in AccessPay", () => careAdmin.decideDispute(d.id, "challenged", note[d.id] ?? "", true, false))}>Challenge</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Accepted", () => careAdmin.decideDispute(d.id, "accepted", note[d.id] ?? "", true, false))}>Accept</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Accepted, one polite letter queued", () => careAdmin.decideDispute(d.id, "accepted", note[d.id] ?? "", true, true))}>Accept + write once</Button>
                    </div>
                  </div>
                ) : d.status === "open" || d.status === "challenged" ? (
                  <div className="flex gap-1">
                    <Input placeholder="Closing note" value={note[d.id] ?? ""} onChange={(e) => setNote({ ...note, [d.id]: e.target.value })} />
                    <Button size="sm" disabled={busy} onClick={() => run("Closed", () => careAdmin.decideDispute(d.id, "closed", note[d.id] ?? "", false, false))}>Close</Button>
                  </div>
                ) : <span className="text-xs">{d.decision_note}</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ------------------------------------------------------------------- Letters
export function LettersPanel({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<Json[]>([]);
  const [filter, setFilter] = useState("to_print");
  const [sel, setSel] = useState<string[]>([]);
  const [posted, setPosted] = useState(today());
  const load = useCallback(async () => { setRows((await careAdmin.letters(filter)) ?? []); setSel([]); }, [filter]);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  const { busy, run } = useCareAction(() => { void load(); onChanged(); });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Every letter is stored as a PDF with a hash. With a Stannp key set, letters post automatically; otherwise print the batch, post them, and mark them posted with the date (your proof of posting). Braille and carer copies need posting by hand.</p>
      <div className="flex flex-wrap items-center gap-2">
        {[["to_print", "To print"], ["problems", "Needs attention"], ["posted", "Posted"], ["sent_to_mail_house", "Mail house"], ["all", "All"]].map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l}</Button>)}
        <Button size="sm" disabled={busy} onClick={async () => { const r = await run("Print batch ready", () => careAdminFn.printBatch(sel.length ? sel : undefined)); if (r?.url) window.open(String(r.url), "_blank", "noopener"); }}><Download className="mr-1 h-4 w-4" />Print batch {sel.length ? `(${sel.length})` : "(all waiting)"}</Button>
        <Input type="date" className="w-40" max={today()} value={posted} onChange={(e) => setPosted(e.target.value)} />
        <Button size="sm" disabled={busy || sel.length === 0} onClick={() => run(`Marked ${sel.length} posted`, () => careAdmin.lettersPosted(sel, posted))}>Mark posted</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Letters and emails sent", () => careAdminFn.dispatchNow())}>Send queued now</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead /><TableHead>Created</TableHead><TableHead>Letter</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead><TableHead>Email</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">Nothing here.</TableCell></TableRow>}
          {rows.map((l) => (
            <TableRow key={l.id}>
              <TableCell><Checkbox checked={sel.includes(l.id)} onCheckedChange={(v) => setSel((s) => v === true ? [...s, l.id] : s.filter((x) => x !== l.id))} /></TableCell>
              <TableCell className="text-xs">{dt(l.created_at)}</TableCell>
              <TableCell className="text-xs">{CARE_LETTER_LABEL[l.letter_type] ?? l.letter_type}{l.large_print ? " · LARGE PRINT" : ""}{l.copy_for ? ` · copy for ${l.copy_for}` : ""}<br /><span className="font-mono">{l.reference}</span></TableCell>
              <TableCell className="text-xs">{l.name}<br />{l.postcode}</TableCell>
              <TableCell className="text-xs">{l.status}{l.posted_on ? ` ${dd(l.posted_on)}` : ""}{l.error ? <><br /><span className="text-destructive">{l.error}</span></> : null}</TableCell>
              <TableCell className="text-xs">{l.email_status ?? "—"}</TableCell>
              <TableCell>{l.pdf_path && <Button size="sm" variant="outline" onClick={() => void openStoragePath(l.pdf_path)}><FileText className="h-3.5 w-3.5" /></Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ------------------------------------------------------------------- Refunds
export function RefundsPanel({ onOpenMember, onChanged }: { onOpenMember: (id: string) => void; onChanged: () => void }) {
  const [rows, setRows] = useState<Json[]>([]);
  const [f, setF] = useState<Record<string, { date: string; ref: string }>>({});
  const load = useCallback(async () => setRows((await careAdmin.refunds()) ?? []), []);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  const { busy, run } = useCareAction(() => { void load(); onChanged(); });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Refunds are paid by bank transfer within 14 days. "Awaiting collection" becomes payable once the related Direct Debit is confirmed paid. Record the bank reference when you've sent it; the customer gets a letter and email.</p>
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Reason</TableHead><TableHead>Due by</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">No refunds.</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell><button className="font-mono text-xs underline" onClick={() => onOpenMember(r.subscription_id)}>{r.reference}</button><br /><span className="text-xs">{r.full_name}</span></TableCell>
              <TableCell>{gbp(r.amount_minor)}</TableCell>
              <TableCell className="text-xs">{r.reason}</TableCell>
              <TableCell className={`text-xs ${r.status === "to_pay" && r.due_by <= today() ? "font-bold text-destructive" : ""}`}>{dd(r.due_by)}</TableCell>
              <TableCell><Badge variant={r.status === "to_pay" ? "destructive" : "outline"}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
              <TableCell className="min-w-[280px]">
                {r.status === "to_pay" ? (
                  <div className="flex flex-wrap gap-1">
                    <Input type="date" className="w-36" value={f[r.id]?.date ?? today()} onChange={(e) => setF({ ...f, [r.id]: { date: e.target.value, ref: f[r.id]?.ref ?? "" } })} />
                    <Input placeholder="Bank reference" className="w-36" value={f[r.id]?.ref ?? ""} onChange={(e) => setF({ ...f, [r.id]: { date: f[r.id]?.date ?? today(), ref: e.target.value } })} />
                    <Button size="sm" disabled={busy} onClick={() => run("Refund marked paid", () => careAdmin.refundAction(r.id, "paid", f[r.id]?.date ?? today(), f[r.id]?.ref ?? ""))}>Paid</Button>
                  </div>
                ) : r.paid_reference ? <span className="text-xs">Paid {dd(r.paid_at)} ref {r.paid_reference}</span> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------- Phone sale
export function PhoneSalePanel({ onChanged }: { onChanged: () => void }) {
  const [customer, setCustomer] = useState<{ id: string; full_name: string | null; account_number: string | null } | null>(null);
  const [plan, setPlan] = useState("essentials");
  const [freq, setFreq] = useState("monthly");
  const [day, setDay] = useState("1");
  const [script, setScript] = useState<Record<string, boolean>>({});
  const [callRef, setCallRef] = useState("");
  const [notes, setNotes] = useState("");
  const { busy, run } = useCareAction(onChanged);
  const price = carePriceMinor(plan, freq) ?? 0;
  const all = CARE_PHONE_SCRIPT.every((l) => script[l.id]);

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        For customers who call. You never take bank details or agreement over the phone: you send a secure link and the customer completes it themselves, with the same key facts, ticks and code as online. Only offer Care if they asked about help with their tech, or after you've helped them. Never to anyone who seems confused, under pressure, or worried about money.
      </p>
      <div><Label>Customer</Label><CustomerPicker value={customer as never} onSelect={(c) => setCustomer(c as never)} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label>Plan</Label><Select value={plan} onValueChange={setPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_PLANS.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Pays</Label><Select value={freq} onValueChange={setFreq}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_FREQUENCIES.map((f) => <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Day</Label><Select value={day} onValueChange={setDay}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1st</SelectItem><SelectItem value="15">15th</SelectItem></SelectContent></Select></div>
      </div>
      <div className="border-[3px] border-foreground p-4">
        <p className="font-display uppercase">Read out, and tick each one as you say it</p>
        <p className="text-xs text-muted-foreground">Price for this choice: {pounds(price)} {freq === "monthly" ? "a month" : freq === "quarterly" ? "every 3 months" : "a year"}.</p>
        <div className="mt-3 space-y-2">
          {CARE_PHONE_SCRIPT.map((l) => (
            <label key={l.id} className="flex items-start gap-2 text-sm"><Checkbox checked={!!script[l.id]} onCheckedChange={(v) => setScript({ ...script, [l.id]: v === true })} /> <span>{l.line}</span></label>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Call recording reference</Label><Input value={callRef} onChange={(e) => setCallRef(e.target.value)} placeholder="Phone system call ID" /></div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <Button disabled={busy || !customer || !all || callRef.trim().length < 3} onClick={async () => {
        const r = await run("Link emailed to the customer", () => careAdminFn.sendInvite({ customer_id: customer!.id, plan, frequency: freq, collection_day: Number(day), script_confirmed: script, call_reference: callRef, call_notes: notes }));
        if (r) { setScript({}); setCallRef(""); setNotes(""); }
      }}>Email the sign-up link</Button>
      <p className="text-xs text-muted-foreground">If the customer can't join (for example an overdue bill, no postal address, or a business account), the reason shows when you press the button.</p>
    </div>
  );
}

// ------------------------------------------------------------------- Reports
export function ReportsPanel() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [r, setR] = useState<Json | null>(null);
  useEffect(() => { careAdmin.report(`${month}-01`).then(setR).catch(() => setR(null)); }, [month]);
  const rows: [string, string][] = r ? [
    ["Live members", String(r.live_members)], ["Joined", String(r.joined)], ["Joined by channel", JSON.stringify(r.joined_by_channel)],
    ["Cancelled", String(r.cancelled)], ["…in cooling-off", String(r.cancelled_in_cooling_off)], ["Declined after review", String(r.declined)],
    ["Money confirmed in", gbp(r.paid_minor)], ["Returned payments", String(r.unpaid)], ["Indemnity claims", String(r.indemnity_claims)],
    ["Refunds", gbp(r.refunds_minor)], ["Complaints", String(r.complaints)], ["Complaints per 1,000", String(r.complaints_per_1000)],
    ["Low-use members (6 months)", String(r.low_use_members)], ["Help given", JSON.stringify(r.usage)], ["Letters sent", String(r.letters_sent)],
  ] : [];
  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center gap-2"><Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!r} onClick={() => downloadText(`occta-care-${month}.csv`, toCsv([["Metric", "Value"], ...rows]))}><Download className="mr-1 h-4 w-4" />CSV</Button></div>
      <p className="text-xs text-muted-foreground">Watch: complaints per 1,000, indemnity claims, cooling-off cancellations and low use. A spike from one person or channel means pause that channel and review its calls.</p>
      <Table><TableBody>{rows.map(([k, v]) => <TableRow key={k}><TableCell className="font-semibold">{k}</TableCell><TableCell>{v}</TableCell></TableRow>)}</TableBody></Table>
      {r && (r.joined_by_staff ?? []).length > 0 && <p className="text-xs">By staff: {(r.joined_by_staff as Json[]).map((s) => `${s.name ?? s.staff_id}: ${s.n}`).join(", ")}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Settings
export function SettingsPanel({ overview, onChanged }: { overview: Json | null; onChanged: () => void }) {
  const { busy, run } = useCareAction(onChanged);
  const st = overview?.settings ?? {};
  const [hours, setHours] = useState<string>(st.support_hours ?? "");
  const [pc, setPc] = useState({ plan: "essentials", freq: "monthly", price: "", date: "", reason: "" });
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3 border-[3px] border-foreground p-4">
        <Switch checked={!!st.sales_open} onCheckedChange={(v) => run(v ? "Sales open" : "Sales closed", () => careAdmin.settings(v, null))} disabled={busy} />
        <div><p className="font-semibold">New sign-ups {st.sales_open ? "OPEN" : "CLOSED"}</p><p className="text-xs text-muted-foreground">Closing stops new joins and invites. Existing members are unaffected.</p></div>
      </div>
      <div className="border-[3px] border-foreground p-4">
        <Label>Support hours shown to customers</Label>
        <div className="mt-2 flex gap-2"><Input value={hours} onChange={(e) => setHours(e.target.value)} /><Button disabled={busy} onClick={() => run("Saved", () => careAdmin.settings(!!st.sales_open, hours))}>Save</Button></div>
      </div>
      <div className="border-[3px] border-foreground p-4">
        <p className="font-semibold">Plans (new sign-ups)</p>
        {(overview?.plans ?? []).map((p: Json) => <p key={p.code} className="text-sm">{p.name}: {gbp(p.monthly_minor)} a month · {p.active ? "on sale" : "not on sale"}</p>)}
        <p className="mt-2 text-xs text-muted-foreground">Launch prices are written into the published terms (care-2026-11-v1). To change prices for new customers, publish a new terms version first. Existing members only change through a 30-day price change notice below.</p>
      </div>
      <div className="border-[3px] border-destructive p-4">
        <p className="font-semibold">Price change for existing members (30 days' notice, free exit)</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Select value={pc.plan} onValueChange={(v) => setPc({ ...pc, plan: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_PLANS.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent></Select>
          <Select value={pc.freq} onValueChange={(v) => setPc({ ...pc, freq: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_FREQUENCIES.map((f) => <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="New price per collection £" value={pc.price} onChange={(e) => setPc({ ...pc, price: e.target.value })} />
          <Input type="date" value={pc.date} onChange={(e) => setPc({ ...pc, date: e.target.value })} />
        </div>
        <Textarea className="mt-2" placeholder="Reason (shown internally)" value={pc.reason} onChange={(e) => setPc({ ...pc, reason: e.target.value })} />
        <Button className="mt-2" variant="destructive" disabled={busy} onClick={() => run("Price change notices queued", () => careAdmin.schedulePriceChange(pc.plan, pc.freq, Math.round(Number(pc.price) * 100), pc.date, pc.reason))}>Send price change notices</Button>
      </div>
      <div className="border-[3px] border-foreground p-4 text-sm">
        <p className="font-semibold">How letters are posted</p>
        <p className="text-xs text-muted-foreground">Letters post automatically through Stannp once the secret STANNP_API_KEY is set on the backend (and STANNP_MODE=live to stop test mode). Until then, every letter waits in Letters → To print.</p>
      </div>
    </div>
  );
}
