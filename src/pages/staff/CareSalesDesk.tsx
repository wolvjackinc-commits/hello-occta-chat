import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { careSales, salesError, SALE_STATUS, type J } from "@/lib/care/sales";
import { transcribeRecording } from "@/lib/care/transcribe";
import { DDProviderSelect, DD_PROVIDERS } from "@/components/care/DDProviderSelect";
import { CareDDGuarantee } from "@/components/care/CareBits";
import { Checkbox } from "@/components/ui/checkbox";
import { providerInstructionText } from "../../../supabase/functions/_shared/directDebitGuarantee.ts";
import { CARE_QA_RED_FLAGS, CARE_SALES_SCRIPT, CARE_QA_PASS_SCORE } from "../../../supabase/functions/_shared/careSalesScript.ts";
import { CARE_FREQUENCIES, CARE_PLANS, carePriceMinor, pounds } from "../../../supabase/functions/_shared/careTerms.ts";

const dt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const tone = (d?: string | null) => (d === "pass" ? "default" : d === "decline" ? "destructive" : "secondary") as "default" | "destructive" | "secondary";
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function CareSalesDesk() {
  const [cfg, setCfg] = useState<{ role: string; transcription: boolean; ai: boolean } | null>(null);
  const [tab, setTab] = useState("new");
  const [rows, setRows] = useState<J[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await careSales.list(cfg?.role === "supervisor" ? "all" : "mine", null)); } catch (e) { toast({ title: "Couldn't load sales", description: salesError(e), variant: "destructive" }); }
  }, [cfg?.role]);
  useEffect(() => { careSales.config().then(setCfg).catch((e) => toast({ title: "Sales Desk unavailable", description: salesError(e), variant: "destructive" })); }, []);
  useEffect(() => { if (cfg) void load(); }, [cfg, load]);

  if (!cfg) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const sup = cfg.role === "supervisor";
  const held = rows.filter((r) => r.status === "held").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-foreground px-4 py-3">
        <div><p className="font-display text-2xl uppercase">OCCTA Care · Sales Desk</p><p className="text-xs text-muted-foreground">{sup ? "Supervisor" : "Sales agent"} · record the call, check it (or bypass), then complete the sign-up on the call</p></div>
        <div className="flex gap-2">{sup && <Button asChild variant="outline" size="sm"><Link to="/admin/care">Admin → Care</Link></Button>}
          <Button variant="outline" size="sm" onClick={() => void supabase.auth.signOut().then(() => { window.location.href = "/auth"; })}>Sign out</Button></div>
      </header>
      {!cfg.ai && <p className="mx-4 mt-3 border-l-4 border-destructive pl-3 text-sm">Call scoring is offline (ANTHROPIC_API_KEY missing). Sales can be logged but not checked.</p>}

      <main className="p-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "list") void load(); }}>
          <TabsList>
            <TabsTrigger value="new">New sale</TabsTrigger>
            <TabsTrigger value="list">{sup ? "All sales" : "My sales"}{sup && held ? ` (${held} held)` : ""}</TabsTrigger>
            <TabsTrigger value="script">Script</TabsTrigger>
            {sup && <TabsTrigger value="report">Report</TabsTrigger>}
          </TabsList>
          <TabsContent value="new"><NewSale onCreated={(id) => { void load(); setOpen(id); }} /></TabsContent>
          <TabsContent value="list"><SalesTable rows={rows} onOpen={setOpen} /></TabsContent>
          <TabsContent value="script"><Script /></TabsContent>
          {sup && <TabsContent value="report"><Report /></TabsContent>}
        </Tabs>
      </main>
      {open && <SaleDialog id={open} cfg={cfg} onClose={() => { setOpen(null); void load(); }} />}
    </div>
  );
}

function NewSale({ onCreated }: { onCreated: (id: string) => void }) {
  const [q, setQ] = useState(""); const [found, setFound] = useState<J[] | null>(null); const [cust, setCust] = useState<J | null>(null);
  const [plan, setPlan] = useState("essentials"); const [freq, setFreq] = useState("monthly"); const [day, setDay] = useState("1");
  const [callRef, setCallRef] = useState(""); const [callAt, setCallAt] = useState(localNow()); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  const [nc, setNc] = useState<Record<string, string> | null>({});
  async function addNew() {
    if (!nc) return; setBusy(true);
    try { const r = await careSales.createCustomer(nc); const c = { ...r.customer, name: r.customer.full_name }; setFound([c]); setCust(c); setNc(null); toast({ title: "Account opened", description: "Now log what they agreed on the call." }); }
    catch (e) { toast({ title: "Couldn't add the customer", description: salesError(e), variant: "destructive" }); } finally { setBusy(false); }
  }
  async function search() { setBusy(true); try { setFound(await careSales.find(q)); } catch (e) { toast({ title: "Search failed", description: salesError(e), variant: "destructive" }); } finally { setBusy(false); } }
  async function create() {
    if (!cust) return; setBusy(true);
    try {
      const r = await careSales.create({ customer: cust.id, plan, frequency: freq, day: Number(day), callRef, callAt: new Date(callAt).toISOString(), notes });
      toast({ title: `Sale ${r.reference} logged`, description: "Now upload the call recording." }); setCust(null); setFound(null); setQ(""); setCallRef(""); setNotes(""); onCreated(r.id);
    } catch (e) { toast({ title: "Couldn't log the sale", description: salesError(e), variant: "destructive" }); } finally { setBusy(false); }
  }
  return (
    <div className="mt-4 grid max-w-3xl gap-4">
      <section className="border-[3px] border-foreground p-4">
        <p className="font-display uppercase">1. Add the customer</p>
        <p className="text-xs text-muted-foreground">Anyone at a UK home address can have Care, whether or not they're with OCCTA.</p>
        {!nc && <Button className="mt-2" onClick={() => { setNc({}); setFound(null); setCust(null); }}>Add a new customer</Button>}
        {nc && (
          <div className="mt-3 grid gap-2 border-2 border-foreground/30 p-3 sm:grid-cols-2">
            {([["full_name", "Full name"], ["email", "Email (optional)"], ["phone", "Mobile or phone"], ["address_line1", "Address line 1"], ["address_line2", "Address line 2 (optional)"], ["city", "Town or city"], ["postcode", "Postcode"]] as const).map(([k, l]) => (
              <div key={k}><Label htmlFor={`nc-${k}`}>{l}</Label><Input id={`nc-${k}`} value={nc[k] ?? ""} onChange={(e) => setNc({ ...nc, [k]: e.target.value })} /></div>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">This opens a free OCCTA account for them. Email is optional: every Care letter is posted.</p>
            <div className="flex gap-2 sm:col-span-2"><Button disabled={busy} onClick={() => void addNew()}>Add customer</Button></div>
          </div>
        )}
        {nc ? <button className="mt-3 text-xs underline" onClick={() => setNc(null)}>Already with OCCTA? Search for their account instead</button> : (<>
          <p className="mt-3 text-xs text-muted-foreground">Existing OCCTA customer: search by account number, email, mobile or full postcode.</p>
          <div className="mt-1 flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="e.g. OCC100234 or HD3 3WU" /><Button variant="outline" onClick={() => void search()} disabled={busy || q.trim().length < 4}>Search</Button></div>
          {found && found.length === 0 && <p className="mt-2 text-sm">No account found. <button className="underline" onClick={() => setNc({ email: q.includes("@") ? q.trim() : "" })}>Add them as a new customer</button></p>}
        </>)}
        {found?.map((c) => (
          <button key={c.id} onClick={() => setCust(c)} className={`mt-2 block w-full border-2 p-2 text-left text-sm ${cust?.id === c.id ? "border-primary bg-primary/10" : "border-foreground/20"}`}>
            <strong>{c.name}</strong> · {c.account_number} · {c.address_line1}, {c.postcode} · {c.email_masked}
            {c.eligibility?.eligible ? <Badge className="ml-2">Eligible</Badge> : <Badge variant="destructive" className="ml-2">Not eligible: {(c.eligibility?.reasons ?? []).join(", ")}</Badge>}
            {(c.eligibility?.review ?? []).length > 0 && <Badge variant="secondary" className="ml-2">Will need review: {c.eligibility.review.join(", ")}</Badge>}
          </button>
        ))}
      </section>
      {cust && (
        <section className="border-[3px] border-foreground p-4">
          <p className="font-display uppercase">2. What the customer agreed on the call</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div><Label>Plan</Label><Select value={plan} onValueChange={setPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_PLANS.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>How often</Label><Select value={freq} onValueChange={setFreq}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_FREQUENCIES.map((f) => <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Payment day</Label><Select value={day} onValueChange={setDay}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1st</SelectItem><SelectItem value="15">15th</SelectItem></SelectContent></Select></div>
          </div>
          <p className="mt-2 text-sm">Price you must have quoted: <strong>{pounds(carePriceMinor(plan, freq))}</strong> {freq === "monthly" ? "a month" : freq === "quarterly" ? "every 3 months" : "a year"}, VAT included.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><Label>Call reference / recording ID</Label><Input value={callRef} onChange={(e) => setCallRef(e.target.value)} placeholder="From your phone system" /></div>
            <div><Label>Call date and time</Label><Input type="datetime-local" value={callAt} max={localNow()} onChange={(e) => setCallAt(e.target.value)} /></div>
          </div>
          <Label className="mt-3 block">Notes (anything the supervisor should know)</Label><Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
          <Button className="mt-3" disabled={busy || !cust.eligibility?.eligible || callRef.trim().length < 3} onClick={() => void create()}>Log sale</Button>
          <p className="mt-2 text-xs text-muted-foreground">Take the bank details only after the call passes (or is bypassed), using the Complete sign-up form. Never take card details.</p>
        </section>
      )}
    </div>
  );
}

function SalesTable({ rows, onOpen }: { rows: J[]; onOpen: (id: string) => void }) {
  const [f, setF] = useState("all");
  const shown = rows.filter((r) => f === "all" || r.status === f);
  return (
    <div className="mt-4">
      <Select value={f} onValueChange={setF}><SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(SALE_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b-2 border-foreground text-left"><th className="p-2">Sale</th><th>Customer</th><th>Plan</th><th>Agent</th><th>Score</th><th>Status</th><th>Logged</th></tr></thead>
        <tbody>{shown.map((r) => (
          <tr key={r.id} className="cursor-pointer border-b hover:bg-secondary/40" onClick={() => onOpen(r.id)}>
            <td className="p-2 font-mono text-xs">{r.reference}</td><td>{r.customer_name}<br /><span className="text-xs text-muted-foreground">{r.account_number}</span></td>
            <td className="text-xs">{r.plan_code} · {r.frequency}</td><td className="text-xs">{r.agent_name}</td>
            <td>{r.qa_score ?? "—"} {r.qa_decision && <Badge variant={tone(r.qa_decision)}>{r.qa_decision}</Badge>}</td>
            <td className="text-xs">{SALE_STATUS[r.status] ?? r.status}{r.care_reference ? ` · ${r.care_reference}` : ""}</td><td className="text-xs">{dt(r.created_at)}</td>
          </tr>))}
          {shown.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={7}>No sales.</td></tr>}</tbody>
      </table></div>
    </div>
  );
}

function SaleDialog({ id, cfg, onClose }: { id: string; cfg: { role: string; transcription: boolean }; onClose: () => void }) {
  const [s, setS] = useState<J | null>(null); const [file, setFile] = useState<File | null>(null); const [stage, setStage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); const [note, setNote] = useState(""); const [audio, setAudio] = useState<string | null>(null);
  const load = useCallback(async () => { try { setS(await careSales.get(id)); } catch (e) { toast({ title: "Couldn't open sale", description: salesError(e), variant: "destructive" }); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function act(label: string, f: () => Promise<unknown>) {
    setBusy(label);
    try { await f(); toast({ title: label }); await load(); } catch (e) { toast({ title: `${label} failed`, description: salesError(e), variant: "destructive" }); } finally { setBusy(null); }
  }
  async function check() {
    await act("Call checked", async () => {
      if (!file) throw new Error("Choose the call recording first");
      if (file.size > 200 * 1024 * 1024) throw new Error("Recording over 200 MB: download the audio-only (M4A) file from Zoom");
      try {
        // Transcribed on this computer, then the text is scored by Claude.
        const transcript = cfg.transcription ? "" : await transcribeRecording(file, (st, pct) => setStage(pct == null ? st : `${st} ${pct}%`));
        setStage("Uploading the recording");
        const path = await careSales.uploadRecording(id, file);
        setStage("Scoring the call against the script");
        const r = await careSales.score(id, path, transcript, cfg.transcription ? null : "audio_local");
        toast({ title: `Result: ${r.decision.toUpperCase()} (${r.score}/100)` });
      } finally { setStage(null); }
    });
  }
  if (!s) return null;
  const qa = s.qa as J | null; const sup = cfg.role === "supervisor";
  const editable = ["awaiting_recording", "passed", "held", "declined"].includes(s.status);
  const canSend = s.status === "approved" || (s.status === "passed" && s.qa_decision === "pass");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{s.reference} · {s.customer?.name} ({s.customer?.account_number})</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{SALE_STATUS[s.status] ?? s.status}</Badge>
          <span>{CARE_PLANS.find((p) => p.code === s.plan_code)?.name} · {pounds(s.price_minor)} {s.frequency} · day {s.collection_day}</span>
          <span className="text-muted-foreground">Agent {s.agent_name} · call {s.call_reference} at {dt(s.call_at)}</span>
          {s.care && <Badge>Joined: {s.care.reference} ({s.care.status})</Badge>}
        </div>
        {s.agent_notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">Notes: {s.agent_notes}</p>}

        {editable && (
          <section className="border-2 border-foreground p-3">
            <p className="font-display uppercase">{s.qa ? "Re-check the call" : "Upload the call recording"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Download the call from Zoom (audio-only M4A is smallest) and choose it here.</p>
            <Input type="file" accept="audio/*,video/mp4,.mp3,.mp4,.wav,.m4a,.ogg,.webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2" />
            {s.recording_path && !file && <p className="mt-1 text-xs">Recording on file ({Math.round((s.recording_bytes ?? 0) / 1024)} KB). Choose it again to re-check.</p>}
            <Button className="mt-2" disabled={!!busy || !file} onClick={() => void check()}>
              {busy === "Call checked" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check the call
            </Button>
            {stage && <p className="mt-2 text-sm" role="status">{stage}… keep this window open.</p>}
            <p className="mt-1 text-xs text-muted-foreground">The recording is turned into text on this computer (the first time downloads the speech model, about 80–300 MB), then Claude scores it. Fixed rules: a mandatory step missed or any red flag means hold or decline, whatever the score.</p>
          </section>
        )}

        {qa && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3"><span className="font-display text-4xl">{s.qa_score}</span><span className="text-sm">/100 (pass mark {CARE_QA_PASS_SCORE})</span>
              <Badge variant={tone(s.qa_decision)} className="text-base uppercase">{s.qa_decision}</Badge><span className="text-xs text-muted-foreground">checked {dt(s.qa_at)} · {s.transcript_source === "pasted" ? "pasted transcript" : "transcribed from the recording"}</span>
              {s.recording_path && <Button size="sm" variant="outline" onClick={() => void careSales.recordingUrl(id).then((r) => setAudio(r.url))}>Play recording</Button>}</div>
            {audio && <audio controls src={audio} className="w-full" />}
            <p className="text-sm">{qa.summary}</p>
            <div className="border-l-4 border-foreground pl-3 text-sm"><p className="font-semibold">Why {s.qa_decision === "pass" ? "it passed" : s.qa_decision === "hold" ? "it's held" : "it's declined"}</p><ul className="list-disc pl-5">{(qa.decision_reasons ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
            {(qa.red_flags ?? []).length > 0 && <div className="border-l-4 border-destructive pl-3 text-sm"><p className="font-semibold">Red flags</p><ul className="list-disc pl-5">{qa.red_flags.map((f: J, i: number) => <li key={i}><strong>{CARE_QA_RED_FLAGS.find((d) => d.id === f.id)?.detail ?? f.id}</strong> ({f.severity}) — "{f.quote}" {f.explanation}</li>)}</ul></div>}
            <table className="w-full text-sm"><thead><tr className="border-b-2 border-foreground text-left"><th className="p-1">Script step</th><th>Result</th><th>Evidence</th></tr></thead>
              <tbody>{CARE_SALES_SCRIPT.map((st) => { const c = (qa.checks ?? []).find((x: J) => x.id === st.id); return (
                <tr key={st.id} className="border-b align-top"><td className="p-1">{st.stage}: {st.id}{st.mandatory && <span className="text-destructive"> *</span>}</td>
                  <td><Badge variant={c?.status === "met" ? "default" : c?.status === "partial" ? "secondary" : "destructive"}>{c?.status ?? "missing"}</Badge></td><td className="text-xs">{c?.evidence}</td></tr>); })}</tbody></table>
            {(qa.corrections ?? []).length > 0 && <div className="text-sm"><p className="font-semibold">What to correct</p><ul className="list-disc pl-5">{qa.corrections.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
            {(qa.strengths ?? []).length > 0 && <div className="text-sm"><p className="font-semibold">Done well</p><ul className="list-disc pl-5">{qa.strengths.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
            {s.transcript && <details className="text-xs"><summary className="cursor-pointer">Transcript</summary><pre className="mt-2 whitespace-pre-wrap">{s.transcript}</pre></details>}
          </section>
        )}

        {s.supervisor_decision && <p className="border-l-4 border-primary pl-3 text-sm">Supervisor {s.supervisor_name} {s.supervisor_decision === "approve" ? "approved" : s.supervisor_decision === "bypass" ? "bypassed the call check" : "declined"} at {dt(s.supervisor_at)}: {s.supervisor_note}</p>}
        {canSend && <CompleteSignup sale={s} onDone={() => void load()} />}
        {s.status === "joined" && s.subscription_id && <FollowUp saleId={id} />}

        <section className="flex flex-wrap items-end gap-2 border-t-2 border-foreground pt-3">
          {sup && ["awaiting_recording", "scoring", "passed", "held", "declined"].includes(s.status) && (<>
            <div className="min-w-[260px] flex-1"><Label>Supervisor note (required)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked, e.g. listened at 03:10, price was confirmed" /></div>
            {["passed", "held", "declined"].includes(s.status) && <>
              <Button disabled={!!busy || note.trim().length < 10} onClick={() => void act("Approved", () => careSales.decide(id, "approve", note))}>Approve</Button>
              <Button variant="destructive" disabled={!!busy || note.trim().length < 10} onClick={() => void act("Declined", () => careSales.decide(id, "decline", note))}>Decline</Button>
            </>}
          </>)}
          {["awaiting_recording", "scoring", "held", "declined"].includes(s.status) && (<>
            {!sup && <div className="min-w-[260px] flex-1"><Label>Reason for bypassing (required)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this sale should go ahead" /></div>}
            <Button variant="secondary" disabled={!!busy || note.trim().length < 20} title="Continue even though the call didn't pass or couldn't be checked. The reason is saved and can't be changed." onClick={() => void act("Call check bypassed: complete the sign-up below", () => careSales.decide(id, "bypass", note))}>Bypass call check</Button>
          </>)}
        </section>
        {s.status !== "withdrawn" && <CancelSale saleId={id} joined={s.status === "joined"} onDone={() => void load()} />}
      </DialogContent>
    </Dialog>
  );
}

function Script() {
  const stages = [...new Set(CARE_SALES_SCRIPT.map((s) => s.stage))];
  return (
    <div className="mt-4 max-w-3xl space-y-4">
      <p className="text-sm">Read every step marked <span className="text-destructive">*</span>. Wait for the customer's own answer. Stop the sale if any red flag below happens.</p>
      {stages.map((st) => (
        <section key={st} className="border-[3px] border-foreground p-4"><p className="font-display uppercase">{st}</p>
          {CARE_SALES_SCRIPT.filter((s) => s.stage === st).map((s) => <p key={s.id} className="mt-2 text-sm">{s.mandatory && <span className="text-destructive">* </span>}“{s.say}”</p>)}</section>
      ))}
      <section className="border-[3px] border-destructive p-4"><p className="font-display uppercase">Stop the sale if</p>
        <ul className="mt-2 list-disc pl-5 text-sm">{CARE_QA_RED_FLAGS.map((f) => <li key={f.id}>{f.detail} <em>({f.severity === "decline" ? "sale will be declined" : "sale will be held"})</em></li>)}</ul></section>
    </div>
  );
}

function Report() {
  const [r, setR] = useState<J[] | null>(null);
  useEffect(() => { careSales.report().then(setR).catch((e) => toast({ title: "Report failed", description: salesError(e), variant: "destructive" })); }, []);
  if (!r) return <Loader2 className="mt-4 h-5 w-5 animate-spin" />;
  return (
    <div className="mt-4 overflow-x-auto"><p className="mb-2 text-xs text-muted-foreground">Last 12 months. Pay bonuses on "active after 90 days", not on sales logged.</p>
      <table className="w-full text-sm"><thead><tr className="border-b-2 border-foreground text-left">{["Agent", "Logged", "Avg score", "Passed", "Held", "Declined", "Joined", "Active 90+ days", "Cancelled in cooling-off", "Indemnity claims"].map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
        <tbody>{r.map((x) => <tr key={x.agent_id} className="border-b"><td className="p-1">{x.agent}</td><td>{x.sales}</td><td>{x.avg_score ?? "—"}</td><td>{x.passed}</td><td>{x.held}</td><td>{x.declined}</td><td>{x.joined}</td><td>{x.active_after_90_days}</td><td>{x.cancelled_in_cooling_off}</td><td>{x.indemnity_claims}</td></tr>)}</tbody></table></div>
  );
}

// Telesales: take everything on the call. The server runs the full sign-up checks and posts the letters.
function CompleteSignup({ sale, onDone }: { sale: J; onDone: () => void }) {
  const [plan, setPlan] = useState<string>(sale.plan_code); const [freq, setFreq] = useState<string>(sale.frequency); const [prov, setProv] = useState("accesspay"); const [firstDate, setFirstDate] = useState(""); const [earliest, setEarliest] = useState("");
  useEffect(() => { void careSales.earliestFirstDate().then(setEarliest).catch(() => setEarliest("")); }, []);
  const fdDay = firstDate ? Number(firstDate.slice(8, 10)) : 0;
  const dateProblem = !firstDate ? "Choose the first payment date." : earliest && firstDate < earliest ? `The earliest date is ${earliest.split("-").reverse().join("/")} (we must post 10 working days' notice first).`
    : fdDay > 28 ? "Choose a day from the 1st to the 28th." : prov === "accesspay" && ![1, 15].includes(fdDay) ? "AccessPay can only collect on the 1st or the 15th." : null; const [startNow, setStartNow] = useState(false); const [dob, setDob] = useState("");
  const [bank, setBank] = useState({ account_holder_name: sale.customer?.name ?? "", sort_code: "", account_number: "", bank_name: "" });
  const [c, setC] = useState({ ddi_read: false, account_holder: false, customer_agreed: false, over_18: false });
  const [busy, setBusy] = useState(false); const [done, setDone] = useState<J | null>(null);
  const price = carePriceMinor(plan, freq as never) ?? 0;
  const dd = DD_PROVIDERS[prov];
  const sortOk = bank.sort_code.replace(/\D/g, "").length === 6; const acctOk = [7, 8].includes(bank.account_number.replace(/\D/g, "").length);
  const ready = !dateProblem && sortOk && acctOk && bank.account_holder_name.trim().length >= 2 && Object.values(c).every(Boolean);
  async function submit() {
    setBusy(true);
    try {
      const r = await careSales.complete(sale.id, { plan, frequency: freq, first_payment_date: firstDate, provider_code: prov, start_now: startNow,
        date_of_birth: dob || null, bank, confirm: c });
      setDone(r); toast({ title: `Signed up: ${r.reference}`, description: "Summary and Direct Debit confirmation are ready to post." }); onDone();
    } catch (e) { toast({ title: "Couldn't complete the sign-up", description: salesError(e), variant: "destructive" }); } finally { setBusy(false); }
  }
  if (done) return (
    <section className="border-[3px] border-primary p-3 text-sm" role="status">
      <p className="font-display uppercase">Signed up · {String(done.reference)}</p>
      <p>Status: {done.status === "pending_review" ? "needs a review before the mandate is lodged (shown in Admin → OCCTA Care)" : `mandate to lodge in ${String(done.provider)}`}.
        Cooling-off ends {String(done.cooling_off_ends_on)}. First payment {String(done.first_collection_date)}.</p>
      <p>Posted automatically: the Care summary (welcome pack) and the Direct Debit confirmation with the Direct Debit Guarantee. They're in Admin → OCCTA Care → Letters to print. If the customer has an email, they get a copy by email too.</p>
    </section>
  );
  return (
    <section className="space-y-3 border-[3px] border-foreground p-3">
      <p className="font-display uppercase">Complete the sign-up on the call</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><Label>Plan</Label><Select value={plan} onValueChange={setPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_PLANS.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>How often</Label><Select value={freq} onValueChange={setFreq}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARE_FREQUENCIES.map((f) => <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="cs-first">First payment date</Label><Input id="cs-first" type="date" min={earliest || undefined} value={firstDate} onChange={(e) => setFirstDate(e.target.value)} aria-invalid={!!firstDate && !!dateProblem} />
          <p className="mt-1 text-xs text-muted-foreground">{prov === "accesspay" ? "AccessPay: the 1st or 15th only." : "FastPay: any day from the 1st to the 28th."} Then the same day each period.</p>
          {firstDate && dateProblem && <p className="text-xs text-destructive" role="alert">{dateProblem}</p>}</div>
        <div><Label>Price</Label><p className="pt-2 font-semibold">{pounds(price)} {freq === "monthly" ? "a month" : freq === "quarterly" ? "every 3 months" : "a year"}</p></div>
      </div>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={startNow} onCheckedChange={(v) => setStartNow(v === true)} /> <span>Customer asked for support to start today (they can still cancel within the 14 days).</span></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="cs-prov">Direct Debit goes on</Label><DDProviderSelect id="cs-prov" value={prov} onChange={setProv} /></div>
        <div><Label htmlFor="cs-dob">Date of birth (if we don't have it)</Label><Input id="cs-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
        <div><Label htmlFor="cs-holder">Name on the bank account</Label><Input id="cs-holder" value={bank.account_holder_name} onChange={(e) => setBank({ ...bank, account_holder_name: e.target.value })} /></div>
        <div><Label htmlFor="cs-bank">Bank name (optional)</Label><Input id="cs-bank" value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} /></div>
        <div><Label htmlFor="cs-sort">Sort code</Label><Input id="cs-sort" inputMode="numeric" placeholder="12-34-56" maxLength={8} value={bank.sort_code} onChange={(e) => setBank({ ...bank, sort_code: e.target.value })} aria-invalid={bank.sort_code !== "" && !sortOk} /></div>
        <div><Label htmlFor="cs-acct">Account number</Label><Input id="cs-acct" inputMode="numeric" placeholder="12345678" maxLength={8} value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} aria-invalid={bank.account_number !== "" && !acctOk} /></div>
      </div>
      <div className="border-2 border-foreground/40 p-3 text-sm">
        <p className="font-semibold">Read this to the customer</p>
        <p className="mt-1">Instruction to your bank or building society: {providerInstructionText({ legal_collection_name: dd.name, service_user_number: dd.sun, advance_notice_working_days: 10 })} Your reference will start OCCTA CARE-.</p>
        <div className="mt-2"><CareDDGuarantee dd={dd} /></div>
      </div>
      <div className="space-y-1 text-sm">
        {([["ddi_read", "I read the Direct Debit Instruction and Guarantee above to the customer."], ["account_holder", "The customer confirmed they are the account holder and can authorise Direct Debits on their own."],
          ["customer_agreed", "The customer clearly agreed to Care and to this Direct Debit, on the recorded call."], ["over_18", "The customer confirmed they are 18 or over."]] as const).map(([k, l]) => (
          <label key={k} className="flex items-start gap-2"><Checkbox checked={c[k]} onCheckedChange={(v) => setC({ ...c, [k]: v === true })} /> <span>{l}</span></label>
        ))}
      </div>
      <Button disabled={busy || !ready} onClick={() => void submit()}>{busy ? "Saving…" : "Complete sign-up"}</Button>
    </section>
  );
}

const LETTER_NAME: Record<string, string> = { welcome_pack: "Care summary (welcome pack)", dd_confirmation: "Direct Debit confirmation and Guarantee" };
const royalMailLink = (ref: string) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(ref.trim())}`;
const fmt = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "-");

// After sign-up: the letters, their posting and tracking, and the payment-reminder call. Add and update only.
function FollowUp({ saleId }: { saleId: string }) {
  const [f, setF] = useState<J | null>(null); const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Record<string, Record<string, string>>>({});
  const [call, setCall] = useState({ outcome: "reminded", note: "" });
  const load = useCallback(async () => { try { setF(await careSales.followup(saleId)); } catch (e) { toast({ title: "Couldn't load the letters", description: salesError(e), variant: "destructive" }); } }, [saleId]);
  useEffect(() => { void load(); }, [load]);
  // Letters are made a few seconds after sign-up: keep checking until every one has its PDF (up to 3 minutes).
  const pending = ((f?.letters ?? []) as J[]).some((l) => !l.pdf && !["cancelled", "failed"].includes(l.status));
  const [polls, setPolls] = useState(0);
  useEffect(() => {
    if (!pending || polls > 45) return;
    const t = setTimeout(() => { setPolls((n) => n + 1); void load(); }, 4000);
    return () => clearTimeout(t);
  }, [pending, polls, load]);
  async function pdf(letterId: string, how: "view" | "download" | "print", name: string) {
    try {
      const r = await careSales.letterUrl(saleId, letterId);
      if (!r.url) throw new Error("not_found");
      if (how === "view") { window.open(r.url, "_blank", "noopener"); return; }
      const blob = await (await fetch(r.url)).blob();
      const url = URL.createObjectURL(blob);
      if (how === "download") {
        const a = document.createElement("a"); a.href = url; a.download = `${name}.pdf`; a.click();
      } else {
        const frame = document.createElement("iframe");
        frame.style.position = "fixed"; frame.style.width = "0"; frame.style.height = "0"; frame.style.border = "0";
        frame.src = url; document.body.appendChild(frame);
        frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); };
        setTimeout(() => frame.remove(), 60000);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (er) { toast({ title: "Couldn't open the letter", description: salesError(er), variant: "destructive" }); }
  }
  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); toast({ title: label }); await load(); } catch (e) { toast({ title: "Not saved", description: salesError(e), variant: "destructive" }); } finally { setBusy(false); }
  }
  if (!f?.subscription) return null;
  const sub = f.subscription as J; const letters = (f.letters ?? []) as J[]; const calls = (f.calls ?? []) as J[];
  const received = letters.some((l) => l.received_on);
  return (
    <section className="space-y-4 border-[3px] border-foreground p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display uppercase">Letters & follow-up · {sub.reference}</p>
        <p className="text-sm">{CARE_PLANS.find((p) => p.code === sub.plan_code)?.name} · {pounds(sub.price_minor)} {sub.frequency} · {sub.provider} · mandate {sub.mandate_status} · status {sub.status}</p>
      </div>
      <p className="text-sm">Cooling-off ends {fmt(sub.cooling_off_ends_on)} · {f.next_payment ? `next payment ${pounds(f.next_payment.amount_minor)} on ${fmt(f.next_payment.due_date)}` : "no payment scheduled"}</p>
      <div className="space-y-3">
        {letters.map((l) => {
          const e = edit[l.id] ?? {}; const set = (k: string, v: string) => setEdit({ ...edit, [l.id]: { ...e, [k]: v } });
          const track = (e.tracking_url ?? l.tracking_url) || ((e.royal_mail_ref ?? l.royal_mail_ref) ? royalMailLink(e.royal_mail_ref ?? l.royal_mail_ref) : null);
          return (
            <div key={l.id} className="border-2 border-foreground/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{LETTER_NAME[l.letter_type] ?? String(l.letter_type).replace(/_/g, " ")}</strong>
                <Badge variant="outline">{l.status === "awaiting_print" ? "ready to print" : l.status}</Badge>
                <span className="text-xs text-muted-foreground">dated {fmt(l.letter_date ?? l.created_at)}{l.email_sent_at ? ` · emailed ${fmt(l.email_sent_at)}` : ""}</span>
                {l.pdf ? (<>
                  <Button size="sm" variant="outline" onClick={() => void pdf(l.id, "view", "")}>View</Button>
                  <Button size="sm" variant="outline" onClick={() => void pdf(l.id, "download", `${sub.reference} ${LETTER_NAME[l.letter_type] ?? l.letter_type}`.replace(/[^\w -]+/g, ""))}>Download</Button>
                  <Button size="sm" variant="outline" onClick={() => void pdf(l.id, "print", "")}>Print</Button>
                </>) : !["cancelled", "failed"].includes(l.status) && <span className="text-xs text-muted-foreground" role="status">Making the PDF…</span>}
                {track && <a className="text-xs underline" href={track} target="_blank" rel="noopener noreferrer">Track with Royal Mail</a>}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <div><Label htmlFor={`po-${l.id}`}>Posted on</Label><Input id={`po-${l.id}`} type="date" value={e.posted_on ?? l.posted_on ?? ""} onChange={(ev) => set("posted_on", ev.target.value)} /></div>
                <div><Label htmlFor={`rm-${l.id}`}>Royal Mail reference</Label><Input id={`rm-${l.id}`} value={e.royal_mail_ref ?? l.royal_mail_ref ?? ""} onChange={(ev) => set("royal_mail_ref", ev.target.value)} placeholder="e.g. AB123456789GB" /></div>
                <div><Label htmlFor={`tu-${l.id}`}>Tracking link (optional)</Label><Input id={`tu-${l.id}`} value={e.tracking_url ?? l.tracking_url ?? ""} onChange={(ev) => set("tracking_url", ev.target.value)} placeholder="https://..." /></div>
                <div><Label htmlFor={`rc-${l.id}`}>Received on</Label><Input id={`rc-${l.id}`} type="date" value={e.received_on ?? l.received_on ?? ""} onChange={(ev) => set("received_on", ev.target.value)} /></div>
              </div>
              {Object.keys(e).length > 0 && <Button size="sm" className="mt-2" disabled={busy} onClick={() => void run("Letter updated", () => careSales.letterUpdate(l.id, e)).then(() => setEdit({ ...edit, [l.id]: {} }))}>Save</Button>}
            </div>
          );
        })}
      </div>
      <div className="border-2 border-foreground/30 p-3 text-sm">
        <p className="font-semibold">Payment reminder call</p>
        {!received ? <p className="text-xs text-muted-foreground">Opens once a letter is marked as received. Then call the customer to check they got it and remind them about the first payment.</p> : (<>
          <p className="text-xs text-muted-foreground">Check they received the letters and remind them: {f.next_payment ? `${pounds(f.next_payment.amount_minor)} on ${fmt(f.next_payment.due_date)}` : "the first payment"}, collected by {sub.provider}, cancel any time.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="w-48"><Label>Outcome</Label><Select value={call.outcome} onValueChange={(v) => setCall({ ...call, outcome: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="reminded">Spoke and reminded</SelectItem><SelectItem value="no_answer">No answer</SelectItem><SelectItem value="call_back">Asked to call back</SelectItem><SelectItem value="wants_to_cancel">Wants to cancel</SelectItem>
            </SelectContent></Select></div>
            <div className="min-w-[240px] flex-1"><Label>Note</Label><Input value={call.note} onChange={(ev) => setCall({ ...call, note: ev.target.value })} placeholder="What was said" /></div>
            <Button disabled={busy || call.note.trim().length < 3} onClick={() => void run(call.outcome === "wants_to_cancel" ? "Cancelled and confirmed to the customer in writing" : "Call saved", () => careSales.reminderCall(saleId, call.outcome, call.note)).then(() => setCall({ outcome: "reminded", note: "" }))}>Save call</Button>
          </div>
        </>)}
        {calls.length > 0 && <ul className="mt-2 space-y-1 text-xs">{calls.map((c, i) => <li key={i}>{dt(c.at)} · {String(c.outcome).replace(/_/g, " ")} · {c.by ?? "staff"}: {c.note}</li>)}</ul>}
      </div>
    </section>
  );
}

// Cancel a sale. Nothing posted yet: cancelled quietly and its letters deleted. Something already posted:
// the customer gets the cancellation letter and only the unsent letters are deleted. Posted letters are kept.
function CancelSale({ saleId, joined, onDone }: { saleId: string; joined: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await careSales.cancel(saleId, reason);
      toast({ title: "Sale cancelled", description: `${r.letters_deleted} unsent letter(s) deleted.${r.cancellation_letter ? " A cancellation letter is ready to post, because the customer already received a letter." : ""}` });
      setOpen(false); onDone();
    } catch (e) { toast({ title: "Couldn't cancel the sale", description: salesError(e), variant: "destructive" }); } finally { setBusy(false); }
  }
  return (
    <section className="border-[3px] border-destructive/60 p-3">
      {!open ? <Button variant="destructive" onClick={() => setOpen(true)}>Cancel this sale</Button> : (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Cancel this sale?</p>
          <p className="text-muted-foreground">{joined ? "The Care plan and its Direct Debit are cancelled and nothing will be collected. " : ""}Letters that haven't been posted or emailed are deleted permanently. Letters already sent are kept as the record of what the customer received.</p>
          <Label htmlFor="cancel-reason">Reason (required)</Label>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer changed their mind on the call" />
          <div className="flex gap-2">
            <Button variant="destructive" disabled={busy || reason.trim().length < 10} onClick={() => void go()}>{busy ? "Cancelling…" : "Yes, cancel the sale"}</Button>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep the sale</Button>
          </div>
        </div>
      )}
    </section>
  );
}
