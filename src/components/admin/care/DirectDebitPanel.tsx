import { useCallback, useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadText, toCsv } from "@/lib/outreach/csv";
import { careAdmin, ADDACS_CODES, ARUDD_CODES, DDICA_CODES, dd, dt, gbp, today, type Json } from "@/lib/care/admin";
import { careAdminFn, sha256HexBrowser } from "@/lib/care/api";
import { useCareAction } from "./MemberDialog";

export function DirectDebitPanel({ onOpenMember, onChanged }: { onOpenMember: (id: string) => void; onChanged: () => void }) {
  const [mandates, setMandates] = useState<Json[]>([]);
  const [colTab, setColTab] = useState("ready");
  const [cols, setCols] = useState<Json[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [run, setRun] = useState<Json | null>(null);
  const [reveal, setReveal] = useState<Json | null>(null);
  const [revealReason, setRevealReason] = useState("Keying Care mandate into AccessPay portal");
  const [dlg, setDlg] = useState<{ kind: string; row: Json } | null>(null);
  const [f, setF] = useState({ ref: "", reason: "", code: "0", date: today(), amount: "" });

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([careAdmin.mandates(), careAdmin.collections(colTab)]);
    setMandates(m ?? []); setCols(c ?? []); setSel([]);
  }, [colTab]);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  const { busy, run: act } = useCareAction(() => { void load(); onChanged(); });
  const [pulledWarn, setPulledWarn] = useState<string | null>(null);

  async function createRun() {
    const r = await act("Collection run created", () => careAdmin.createRun(sel));
    if (!r) return;
    const rows = (r.rows ?? []) as Json[];
    const csv = toCsv([
      ["Reference", "Account holder", "Amount", "Collection date", "Provider reference", "OCCTA account", "Type", "Period"],
      ...rows.map((x) => [x.reference, x.account_holder, x.amount, x.due_date, x.provider_reference, x.customer_account, x.kind, x.period]),
    ]);
    await careAdmin.runAction(String(r.run_id), "csv", await sha256HexBrowser(csv));
    downloadText(`${r.run_number}.csv`, csv);
    setRun({ ...r, csv });
  }

  const copy = (v: string) => { void navigator.clipboard?.writeText(v); };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl uppercase">Mandates to action</h2>
        <p className="text-sm text-muted-foreground">Care mandates are lodged manually in the AccessPay portal (APS Re OCCTA, SUN 538166) under the OCCTA CARE- reference. They are separate from broadband mandates. Bacs: lodge within 10 working days of signing.</p>
        <Table className="mt-3">
          <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Bank</TableHead><TableHead>Lodge by</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {mandates.length === 0 && <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">Nothing to do.</TableCell></TableRow>}
            {mandates.map((m) => {
              const late = m.status === "awaiting_lodgement" && m.lodge_due_by && m.lodge_due_by <= today();
              return (
                <TableRow key={m.id}>
                  <TableCell><button className="font-mono text-xs underline" onClick={() => onOpenMember(m.subscription_id)}>{m.reference}</button></TableCell>
                  <TableCell className="text-xs">{m.full_name}<br />{m.account_number}</TableCell>
                  <TableCell><Badge variant={m.status === "on_hold" ? "destructive" : m.status === "cancel_requested" ? "destructive" : "secondary"}>{m.status === "on_hold" ? "on hold (review)" : m.status}</Badge></TableCell>
                  <TableCell className="text-xs">{m.account_holder_name}<br />**-**-{m.masked_sort_last2} / ****{m.masked_account_last4}</TableCell>
                  <TableCell className={`text-xs ${late ? "font-bold text-destructive" : ""}`}>{dd(m.lodge_due_by)}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {["awaiting_lodgement", "lodged", "cancel_requested"].includes(m.status) && m.details_available && (
                      <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "reveal", row: m })}>Bank details</Button>
                    )}
                    {m.status === "awaiting_lodgement" && <Button size="sm" onClick={() => { setF({ ...f, ref: "" }); setDlg({ kind: "lodged", row: m }); }}>Lodged</Button>}
                    {m.status === "lodged" && <Button size="sm" disabled={busy} onClick={() => act("Mandate active", () => careAdmin.mandateAction(m.id, "active"))}>Active</Button>}
                    {["awaiting_lodgement", "lodged"].includes(m.status) && <Button size="sm" variant="destructive" onClick={() => setDlg({ kind: "rejected", row: m })}>Rejected</Button>}
                    {m.status === "cancel_requested" && <Button size="sm" disabled={busy} onClick={() => act("Mandate cancelled", () => careAdmin.mandateAction(m.id, "cancelled", null, "Cancelled in AccessPay portal"))}>Cancelled in portal</Button>}
                    {["lodged", "cancel_requested"].includes(m.status) && <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "addacs", row: m })}>Bank cancelled (ADDACS)</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="font-display text-xl uppercase">Collections</h2>
        <p className="text-sm text-muted-foreground">A collection becomes ready only when the mandate is active and the notice actually reached the customer at least 10 working days before the date (email sent, or letter posted + 2 working days). Letters waiting in the print queue don't count. Mark paid only once the money is in the bank and the return window (3 working days) has passed.</p>
        {pulledWarn && <p className="mt-3 border-l-4 border-destructive pl-3 text-sm" role="alert">{pulledWarn} <button className="underline" onClick={() => setPulledWarn(null)}>Dismiss</button></p>}
        <Tabs value={colTab} onValueChange={setColTab} className="mt-3">
          <TabsList>
            <TabsTrigger value="ready">Ready to submit</TabsTrigger><TabsTrigger value="submitted">Awaiting result</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming (35 days)</TabsTrigger><TabsTrigger value="unpaid">Returned</TabsTrigger><TabsTrigger value="paid">Paid</TabsTrigger><TabsTrigger value="pulled">Pulled from a run</TabsTrigger>
          </TabsList>
          <TabsContent value={colTab}>
            {colTab === "ready" && (
              <div className="my-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSel(sel.length === cols.length ? [] : cols.map((c) => c.id))}>{sel.length === cols.length && cols.length ? "Clear" : "Select all"}</Button>
                <Button size="sm" disabled={busy || sel.length === 0} onClick={() => void createRun()}><Download className="mr-1 h-4 w-4" />Create run + CSV ({sel.length})</Button>
              </div>
            )}
            <Table>
              <TableHeader><TableRow>{colTab === "ready" && <TableHead />}<TableHead>Due</TableHead><TableHead>Reference</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Kind</TableHead><TableHead>Notice</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {cols.length === 0 && <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">None.</TableCell></TableRow>}
                {cols.map((c) => (
                  <TableRow key={c.id}>
                    {colTab === "ready" && <TableCell><Checkbox checked={sel.includes(c.id)} onCheckedChange={(v) => setSel((s) => v === true ? [...s, c.id] : s.filter((x) => x !== c.id))} /></TableCell>}
                    <TableCell className="text-xs">{dd(c.due_date)}</TableCell>
                    <TableCell><button className="font-mono text-xs underline" onClick={() => onOpenMember(c.subscription_id)}>{c.reference}</button>{c.run_number && <p className="text-[10px] text-muted-foreground">{c.run_number}</p>}</TableCell>
                    <TableCell className="text-xs">{c.full_name}<br />{c.account_number}</TableCell>
                    <TableCell>{gbp(c.amount_minor)}</TableCell>
                    <TableCell className="text-xs">{c.kind}</TableCell>
                    <TableCell className="text-xs">{c.notice_kind ?? "—"}<br />{c.notice_delivered_on ? `reached customer ${dd(c.notice_delivered_on)}` : c.notice_dedupe ? <span className="text-destructive">not delivered yet</span> : "—"}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {c.status === "submitted" && <>
                        <Button size="sm" onClick={() => { setF({ ...f, date: today() }); setDlg({ kind: "paid", row: c }); }}>Paid</Button>
                        <Button size="sm" variant="destructive" onClick={() => { setF({ ...f, code: "0" }); setDlg({ kind: "unpaid", row: c }); }}>Returned</Button>
                      </>}
                      {c.status === "paid" && <Button size="sm" variant="outline" onClick={() => { setF({ ...f, code: "0" }); setDlg({ kind: "unpaid", row: c }); }}>Late return</Button>}
                      {c.status === "paid" && <Button size="sm" variant="outline" onClick={() => { setF({ ...f, code: "1", date: today(), amount: "" }); setDlg({ kind: "indemnity", row: c }); }}>Indemnity claim</Button>}
                      {c.status === "cancelled" && c.run_submitted_at && !String(c.cancelled_reason ?? "").includes("collected anyway") && (
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void act("Recorded and full refund queued", () => careAdmin.pulledItemCollected(c.id, "Bank collected it after it was pulled from the run"))}>Collected anyway</Button>
                      )}
                      {c.status === "cancelled" && <span className="block text-[10px] text-muted-foreground">{c.cancelled_reason}</span>}
                      {c.status === "unpaid" && <span className="text-xs">ARUDD {c.unpaid_reason_code}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </section>

      {/* Run created: confirm submission */}
      <Dialog open={!!run} onOpenChange={(o) => { if (!o) setRun(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{run?.run_number}</DialogTitle>
            <DialogDescription>The CSV has downloaded. Upload or key these collections in the AccessPay portal, then confirm. If you don't submit them, void the run so they go back to ready.</DialogDescription></DialogHeader>
          <p className="text-sm">{(run?.rows ?? []).length} collections</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => run && downloadText(`${run.run_number}.csv`, String(run.csv))}>Download again</Button>
            <Button variant="destructive" disabled={busy} onClick={async () => { if (run) { await act("Run voided", () => careAdmin.runAction(String(run.run_id), "void", null, "Not submitted to AccessPay")); setRun(null); } }}>Void</Button>
            <Button disabled={busy} onClick={async () => { if (run) { const r = await act("Run marked submitted", () => careAdmin.runAction(String(run.run_id), "submitted")); setRun(null); if (r && Array.isArray(r.pulled) && r.pulled.length) { setPulledWarn(`${String(r.warning)} (${r.pulled.map((x: { reference: string }) => x.reference).join(", ")})`); setColTab("pulled"); } } }}>Submitted in AccessPay</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action dialogs */}
      <Dialog open={!!dlg} onOpenChange={(o) => { if (!o) { setDlg(null); setReveal(null); } }}>
        <DialogContent>
          {dlg?.kind === "reveal" && (<>
            <DialogHeader><DialogTitle>Bank details · {dlg.row.reference}</DialogTitle><DialogDescription>Finance roles only. This view is logged with your reason.</DialogDescription></DialogHeader>
            {!reveal ? (<>
              <Input value={revealReason} onChange={(e) => setRevealReason(e.target.value)} />
              <DialogFooter><Button disabled={busy} onClick={async () => { const r = await act("Bank details shown (logged)", () => careAdminFn.revealBank(dlg.row.id, revealReason)); if (r) setReveal(r); }}>Show</Button></DialogFooter>
            </>) : (
              <div className="space-y-2 font-mono text-sm">
                {[["Reference", reveal.reference], ["Account holder", reveal.account_holder_name], ["Sort code", reveal.sort_code], ["Account number", reveal.account_number], ["Bank", reveal.bank_name ?? "—"], ["Collected by", `${reveal.collection_name} (SUN ${reveal.service_user_number})`]].map(([k, v]) => (
                  <p key={k} className="flex items-center justify-between gap-2"><span>{k}: <strong>{v}</strong></span><Button size="sm" variant="ghost" onClick={() => copy(String(v))}><Copy className="h-3.5 w-3.5" /></Button></p>
                ))}
              </div>
            )}
          </>)}
          {dlg?.kind === "lodged" && (<>
            <DialogHeader><DialogTitle>Mark lodged · {dlg.row.reference}</DialogTitle></DialogHeader>
            <Input placeholder="AccessPay reference (optional)" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} />
            <DialogFooter><Button disabled={busy} onClick={async () => { await act("Mandate lodged", () => careAdmin.mandateAction(dlg.row.id, "lodged", f.ref)); setDlg(null); }}>Save</Button></DialogFooter>
          </>)}
          {dlg?.kind === "rejected" && (<>
            <DialogHeader><DialogTitle>Rejected by bank · {dlg.row.reference}</DialogTitle><DialogDescription>Care is cancelled and the customer is told nothing was taken.</DialogDescription></DialogHeader>
            <Input placeholder="AUDDIS reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            <DialogFooter><Button variant="destructive" disabled={busy} onClick={async () => { await act("Recorded rejection", () => careAdmin.mandateAction(dlg.row.id, "rejected", null, f.reason)); setDlg(null); }}>Record</Button></DialogFooter>
          </>)}
          {dlg?.kind === "addacs" && (<>
            <DialogHeader><DialogTitle>Cancelled at the bank · {dlg.row.reference}</DialogTitle><DialogDescription>Stops every collection not yet submitted and cancels Care.</DialogDescription></DialogHeader>
            <Select value={f.code} onValueChange={(v) => setF({ ...f, code: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ADDACS_CODES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <DialogFooter><Button variant="destructive" disabled={busy} onClick={async () => { await act("Recorded bank cancellation", () => careAdmin.bankCancelled(dlg.row.id, f.code, f.date)); setDlg(null); }}>Record</Button></DialogFooter>
          </>)}
          {dlg?.kind === "paid" && (<>
            <DialogHeader><DialogTitle>Money received · {dlg.row.reference} · {gbp(dlg.row.amount_minor)}</DialogTitle><DialogDescription>Only once it's in the bank (AccessPay report or bank statement).</DialogDescription></DialogHeader>
            <Input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <DialogFooter><Button disabled={busy} onClick={async () => { await act("Marked paid", () => careAdmin.recordResult(dlg.row.id, "paid", f.date, null, null)); setDlg(null); }}>Confirm paid</Button></DialogFooter>
          </>)}
          {dlg?.kind === "unpaid" && (<>
            <DialogHeader><DialogTitle>Returned unpaid · {dlg.row.reference}</DialogTitle><DialogDescription>Code 0 (refer to payer): one re-try with fresh notice. Codes that end the Instruction pause Care. Any other code: no re-try, and you get a task to call the customer. After 2 misses Care pauses. Nothing is chased.</DialogDescription></DialogHeader>
            <Select value={f.code} onValueChange={(v) => setF({ ...f, code: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ARUDD_CODES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            <DialogFooter><Button variant="destructive" disabled={busy} onClick={async () => { await act("Recorded return", () => careAdmin.recordResult(dlg.row.id, "unpaid", null, f.code, null)); setDlg(null); }}>Record</Button></DialogFooter>
          </>)}
          {dlg?.kind === "indemnity" && (<>
            <DialogHeader><DialogTitle>Indemnity claim (DDICA) · {dlg.row.reference}</DialogTitle><DialogDescription>You have 9 days from the DDICA date to challenge. Generate the evidence pack before deciding.</DialogDescription></DialogHeader>
            <Select value={f.code} onValueChange={(v) => setF({ ...f, code: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DDICA_CODES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <Input placeholder={`Amount £ (default ${gbp(dlg.row.amount_minor)})`} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            <DialogFooter><Button variant="destructive" disabled={busy} onClick={async () => { await act("Indemnity claim recorded", () => careAdmin.indemnity(dlg.row.id, f.code, f.amount ? Math.round(Number(f.amount) * 100) : null, f.date)); setDlg(null); }}>Record</Button></DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
