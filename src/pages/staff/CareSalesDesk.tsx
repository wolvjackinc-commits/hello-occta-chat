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
        <div><p className="font-display text-2xl uppercase">OCCTA Care · Sales Desk</p><p className="text-xs text-muted-foreground">{sup ? "Supervisor" : "Sales agent"} · every sale needs its call recording and passes a call check before the customer gets a link</p></div>
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
        <p className="font-display uppercase">1. Find the customer's OCCTA account</p>
        <p className="text-xs text-muted-foreground">Account number, email, mobile or postcode. Care is only for existing residential OCCTA customers.</p>
        <div className="mt-2 flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="e.g. OCC100234 or HD3 3WU" /><Button onClick={() => void search()} disabled={busy || q.trim().length < 4}>Search</Button></div>
        {found && found.length === 0 && <p className="mt-2 text-sm">No account found. The customer needs an OCCTA account first.</p>}
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
          <p className="mt-2 text-xs text-muted-foreground">Never take bank details on the call. The customer enters them through the link.</p>
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

        {s.supervisor_decision && <p className="border-l-4 border-primary pl-3 text-sm">Supervisor {s.supervisor_name} {s.supervisor_decision === "approve" ? "approved" : "declined"} at {dt(s.supervisor_at)}: {s.supervisor_note}</p>}
        {s.invite && <p className="text-sm">Link sent {dt(s.invite.sent_at)} (email {s.invite.email_status}) · expires {dt(s.invite.expires_at)}{s.invite.used_at ? ` · used ${dt(s.invite.used_at)}` : ""}</p>}

        <section className="flex flex-wrap items-end gap-2 border-t-2 border-foreground pt-3">
          {canSend && <Button disabled={!!busy} onClick={() => void act("Sign-up link emailed to the customer", () => careSales.sendLink(id))}>Send the customer their sign-up link</Button>}
          {sup && ["passed", "held", "declined"].includes(s.status) && (<>
            <div className="min-w-[260px] flex-1"><Label>Supervisor note (required)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked, e.g. listened at 03:10, price was confirmed" /></div>
            <Button disabled={!!busy || note.trim().length < 10} onClick={() => void act("Approved", () => careSales.decide(id, "approve", note))}>Approve</Button>
            <Button variant="destructive" disabled={!!busy || note.trim().length < 10} onClick={() => void act("Declined", () => careSales.decide(id, "decline", note))}>Decline</Button>
          </>)}
          {!["joined", "withdrawn"].includes(s.status) && <Button variant="outline" disabled={!!busy} onClick={() => void act("Withdrawn", () => careSales.withdraw(id, note || "withdrawn by staff"))}>Withdraw sale</Button>}
        </section>
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
