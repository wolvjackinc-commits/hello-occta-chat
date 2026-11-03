import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { careAdmin, dd, dt, gbp, REVIEW_LABEL, STATUS_TONE, today, USAGE_KINDS, type Json } from "@/lib/care/admin";
import { careAdminFn, careApi, CARE_LETTER_LABEL } from "@/lib/care/api";

export function useCareAction(onDone?: () => void) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const r = (await fn()) as Json | undefined;
      if (r && r.ok === false) throw new Error(String(r.error ?? "failed"));
      toast({ title: label });
      onDone?.();
      return r;
    } catch (e) {
      toast({ title: `${label}: failed`, description: String((e as Error).message), variant: "destructive" });
      return undefined;
    } finally { setBusy(false); }
  }, [onDone, toast]);
  return { busy, run };
}

export async function openStoragePath(path: string) {
  window.open(await careApi.letterUrl(path), "_blank", "noopener");
}

export function MemberDialog({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [m, setM] = useState<Json | null>(null);
  const load = useCallback(async () => { if (id) setM(await careAdmin.member(id)); }, [id]);
  useEffect(() => { setM(null); void load().catch(() => {}); }, [load]);
  const { busy, run } = useCareAction(() => { void load(); onChanged(); });

  const [note, setNote] = useState("");
  const [cancelChannel, setCancelChannel] = useState("phone");
  const [usageKind, setUsageKind] = useState("support_call");
  const [refund, setRefund] = useState({ amount: "", reason: "", collection: "" });
  const [complaint, setComplaint] = useState({ summary: "", desired: "", channel: "phone" });
  const [ddi, setDdi] = useState(today());

  if (!id) return null;
  const s = m?.subscription as Json | undefined;
  const c = m?.customer as Json | undefined;

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>{s ? `${s.reference} · ${c?.name ?? ""}` : "Loading…"}</DialogTitle></DialogHeader>
        {!m && <Loader2 className="h-5 w-5 animate-spin" />}
        {m && s && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={STATUS_TONE[s.status] ?? "outline"}>{s.status}</Badge>
              <span>{s.plan_code} · {s.frequency} · {gbp(s.price_minor)}</span>
              <span>· joined {dt(s.joined_at)} via {s.channel}</span>
              <span>· account {c?.account_number}</span>
              {(s.review_reasons ?? []).map((r: string) => <Badge key={r} variant="outline">{REVIEW_LABEL[r] ?? r}</Badge>)}
            </div>
            <p className="text-xs text-muted-foreground">{c?.address} · {c?.email} · {c?.phone}</p>

            <Tabs defaultValue="actions">
              <TabsList className="flex-wrap">
                <TabsTrigger value="actions">Actions</TabsTrigger>
                <TabsTrigger value="money">Payments ({(m.collections ?? []).length})</TabsTrigger>
                <TabsTrigger value="letters">Letters ({(m.letters ?? []).length})</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="timeline">Timeline ({(m.events ?? []).length})</TabsTrigger>
              </TabsList>

              <TabsContent value="actions" className="space-y-4">
                <Label>Note for any action below (required for review decisions)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked / what the customer said" />

                {s.status === "pending_review" && (
                  <div className="border-2 border-destructive p-3">
                    <p className="text-sm font-semibold">Review before the mandate is lodged</p>
                    <p className="text-xs text-muted-foreground">{s.review_hold_until ? `Pause until ${dt(s.review_hold_until)}. ` : ""}Call the customer: check they understand it's not insurance, the price, and that they can cancel free. Decline if in any doubt (nothing has been taken).{(s.review_reasons ?? []).includes("age_extra_check") ? " For 75+ customers, record the welcome call below before approving." : ""} Their first payment notice is sent when you approve.</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => run("Approved", () => careAdmin.review(s.id, "approve", note))}>Approve</Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => run("Declined", () => careAdmin.review(s.id, "decline", note))}>Decline</Button>
                    </div>
                  </div>
                )}

                {!s.welcome_call_done_at && (s.welcome_call_due_on || (s.review_reasons ?? []).length > 0) && ["pending_review", "pending_mandate", "active"].includes(s.status) && (
                  <div className="border-2 border-foreground p-3">
                    <p className="text-sm font-semibold">Welcome call {s.welcome_call_due_on ? `due ${dd(s.welcome_call_due_on)}` : "needed"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => run("Welcome call: confirmed", () => careAdmin.welcomeCall(s.id, "confirmed", note))}>Confirmed they want it</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Welcome call: no answer", () => careAdmin.welcomeCall(s.id, "no_answer", note))}>No answer</Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => run("Cancelled on welcome call", () => careAdmin.welcomeCall(s.id, "wants_to_cancel", note))}>Wants to cancel</Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border-2 border-foreground p-3">
                    <p className="text-sm font-semibold">Record help given</p>
                    <Select value={usageKind} onValueChange={setUsageKind}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>{USAGE_KINDS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
                    <Button size="sm" className="mt-2" disabled={busy} onClick={() => run("Usage recorded", () => careAdmin.usage(s.id, usageKind, note))}>Record</Button>
                  </div>

                  <div className="border-2 border-foreground p-3 md:col-span-2">
                    <p className="text-sm font-semibold">Send a document (letter + email, PDF kept on record)</p>
                    <p className="text-xs text-muted-foreground">Copies are marked "copy" and never change payments or notice. For a staff letter, put the subject on the first line of the note and the letter below it. Insurance, card-payment and debt-chasing words are blocked.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Welcome pack copy queued", () => careAdmin.queueDocument(s.id, "welcome_pack", null, null))}>Welcome pack copy</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Direct Debit confirmation copy queued", () => careAdmin.queueDocument(s.id, "dd_confirmation", null, null))}>DD mandate confirmation copy</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Agreement copy queued", () => careAdmin.queueDocument(s.id, "agreement_copy", null, null))}>Agreement (contract) copy</Button>
                      <Button size="sm" variant="outline" disabled={busy || note.trim().split("\n").length < 2} onClick={() => { const [subject, ...rest] = note.trim().split("\n"); return run("Letter queued", () => careAdmin.queueDocument(s.id, "general_letter", subject.trim(), rest.join("\n").trim())); }}>Staff letter from note</Button>
                    </div>
                  </div>

                  {["active", "pending_mandate", "pending_review"].includes(s.status) && (
                    <div className="border-2 border-foreground p-3">
                      <p className="text-sm font-semibold">Pause Care (money tight, or the customer asks)</p>
                      <p className="text-xs text-muted-foreground">Stops all payments straight away; nothing is owed. They can join again from My OCCTA whenever they like. Put what they told you in the note.</p>
                      <Button size="sm" variant="outline" className="mt-2" disabled={busy || note.trim().length < 5} onClick={() => run("Paused", () => careAdmin.pause(s.id, note))}>Pause Care</Button>
                    </div>
                  )}

                  {!["cancelled", "declined"].includes(s.status) && (
                    <div className="border-2 border-foreground p-3">
                      <p className="text-sm font-semibold">Cancel for the customer</p>
                      <p className="text-xs text-muted-foreground">Accept every cancellation, by any channel, straight away. One "is there anything we can fix?" at most.</p>
                      <Select value={cancelChannel} onValueChange={setCancelChannel}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>{["phone", "email", "letter", "chat", "occta"].map((x) => <SelectItem key={x} value={x}>{x === "occta" ? "OCCTA decision" : `Customer by ${x}`}</SelectItem>)}</SelectContent></Select>
                      <Button size="sm" variant="destructive" className="mt-2" disabled={busy || note.trim().length < 3} onClick={() => run("Cancelled", () => careAdmin.cancel(s.id, cancelChannel, note))}>Cancel Care</Button>
                    </div>
                  )}

                  <div className="border-2 border-foreground p-3">
                    <p className="text-sm font-semibold">Goodwill / complaint refund</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Input placeholder="Amount £" inputMode="decimal" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
                      <Select value={refund.collection} onValueChange={(v) => setRefund({ ...refund, collection: v })}><SelectTrigger><SelectValue placeholder="Against payment" /></SelectTrigger>
                        <SelectContent>{(m.collections ?? []).filter((x: Json) => ["paid", "submitted"].includes(x.status)).map((x: Json) => <SelectItem key={x.id} value={x.id}>{dd(x.due_date)} {gbp(x.amount_minor)}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <Input className="mt-2" placeholder="Reason (10+ characters)" value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
                    <Button size="sm" className="mt-2" disabled={busy} onClick={() => run("Refund created", () => careAdmin.goodwillRefund(s.id, refund.collection || null, Math.round(Number(refund.amount) * 100), refund.reason))}>Create refund</Button>
                  </div>

                  <div className="border-2 border-foreground p-3">
                    <p className="text-sm font-semibold">Log a complaint</p>
                    <Textarea className="mt-2" placeholder="What the customer is unhappy about" value={complaint.summary} onChange={(e) => setComplaint({ ...complaint, summary: e.target.value })} />
                    <Input className="mt-2" placeholder="What they want to happen" value={complaint.desired} onChange={(e) => setComplaint({ ...complaint, desired: e.target.value })} />
                    <Button size="sm" className="mt-2" disabled={busy} onClick={() => run("Complaint logged (see Support → Complaints)", () => careAdmin.raiseComplaint(s.id, complaint.summary, complaint.desired, complaint.channel))}>Log complaint</Button>
                    <p className="mt-1 text-xs text-muted-foreground">Resolve fast: if any rule was missed, or the customer may be vulnerable, refund and cancel.</p>
                  </div>

                  <div className="border-2 border-foreground p-3">
                    <p className="text-sm font-semibold">Support needs</p>
                    <p className="text-xs">{m.support_needs ? `${(m.support_needs.needs ?? []).join(", ") || "none"}${m.support_needs.staff_sales_block ? " · SALES BLOCKED" : ""} (consent ${dt(m.support_needs.consent_at)})` : "None recorded"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Sales block on", () => careAdmin.supportNeeds(String(c?.id), m.support_needs?.needs ?? [], true, note || "Sales block set by staff", "customer_phone"))}>Block sales</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Large print on", () => careAdmin.supportNeeds(String(c?.id), Array.from(new Set([...(m.support_needs?.needs ?? []), "large_print"])), !!m.support_needs?.staff_sales_block, note, "customer_phone"))}>Large print (customer asked)</Button>
                    </div>
                  </div>

                  <div className="border-2 border-foreground p-3">
                    <p className="text-sm font-semibold">Bank asked for a copy of the DDI</p>
                    <Input type="date" className="mt-2" value={ddi} onChange={(e) => setDdi(e.target.value)} />
                    <Button size="sm" className="mt-2" disabled={busy} onClick={() => run("DDI request logged (7 working days)", () => careAdmin.ddiRequest(s.id, ddi, note))}>Log request</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="money" className="space-y-3 text-sm">
                <table className="w-full text-xs"><thead><tr className="text-left"><th>Due</th><th>Kind</th><th>Amount</th><th>Period</th><th>Status</th><th>Notice</th><th>Money in</th></tr></thead>
                  <tbody>{(m.collections ?? []).map((x: Json) => (
                    <tr key={x.id} className="border-t"><td>{dd(x.due_date)}</td><td>{x.kind}</td><td>{gbp(x.amount_minor)}</td><td>{dd(x.period_start)}–{dd(x.period_end)}</td>
                      <td>{x.status}{x.unpaid_reason_code ? ` (ARUDD ${x.unpaid_reason_code})` : ""}</td><td>{x.notice_kind ?? "—"} {dt(x.notice_sent_at)}</td><td>{dd(x.bank_received_date)}</td></tr>
                  ))}</tbody></table>
                <p className="font-semibold">Mandates</p>
                {(m.mandates ?? []).map((x: Json) => <p key={x.id} className="text-xs">{x.reference} · {x.status} · {x.holder} ****{x.last4} · lodge by {dd(x.lodge_due_by)} · lodged {dt(x.lodged_at)} {x.provider_reference ?? ""} · active {dt(x.activated_at)} {x.cancel_source ? `· cancelled (${x.cancel_source} ${x.cancel_reason_code ?? ""})` : ""}</p>)}
                <p className="font-semibold">Refunds</p>
                {(m.refunds ?? []).map((x: Json) => <p key={x.id} className="text-xs">{gbp(x.amount_minor)} · {x.status} · {x.reason} {x.paid_reference ? `· paid ${x.paid_at} ref ${x.paid_reference}` : ""}</p>)}
                <p className="font-semibold">Disputes</p>
                {(m.disputes ?? []).map((x: Json) => <p key={x.id} className="text-xs">{x.kind} {x.bacs_reason_code ?? ""} · {x.status} · respond by {dd(x.respond_by)}</p>)}
              </TabsContent>

              <TabsContent value="letters" className="space-y-1 text-xs">
                {(m.letters ?? []).map((l: Json) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 border-t py-1">
                    <span>{dt(l.created_at)} · {CARE_LETTER_LABEL[l.type] ?? l.type}{l.copy_for ? ` (copy for ${l.copy_for})` : ""} · {l.status}{l.posted_on ? ` · posted ${dd(l.posted_on)}` : ""} · email {l.email_status ?? "—"}{l.error ? ` · ${l.error}` : ""}</span>
                    {l.pdf_path && <Button size="sm" variant="outline" onClick={() => void openStoragePath(l.pdf_path)}><FileText className="h-3.5 w-3.5" /></Button>}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="evidence" className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {[["internal_review", "Evidence pack"], ["indemnity_challenge", "For indemnity challenge"], ["ddi_copy", "DDI copy for bank"], ["complaint", "For complaint"]].map(([p, l]) => (
                    <Button key={p} size="sm" variant="outline" disabled={busy} onClick={async () => {
                      const r = await run("Evidence pack created", () => careAdminFn.evidencePack(s.id, p));
                      if (r?.url) window.open(String(r.url), "_blank", "noopener");
                    }}>{l}</Button>
                  ))}
                </div>
                {(m.evidence_packs ?? []).map((e: Json) => <p key={e.id} className="text-xs">{dt(e.created_at)} · {e.purpose} · sha256 {String(e.pdf_sha256).slice(0, 16)}… <button className="underline" onClick={() => void openStoragePath(e.pdf_path)}>open</button></p>)}
                <p className="font-semibold">Agreement records</p>
                {(m.consents ?? []).map((k: Json) => (
                  <div key={k.id} className="border p-2 text-xs">
                    <p><strong>{k.kind}</strong> {dt(k.created_at)} · terms {k.terms_version} ({String(k.terms_sha256).slice(0, 12)}…) · {k.verification_method} to {k.verification_destination} at {dt(k.verified_at)} · IP {k.ip}</p>
                    <ul className="list-disc pl-4">{(k.key_facts ?? []).map((f: string) => <li key={f}>{f}</li>)}</ul>
                  </div>
                ))}
                {m.invite && <p className="text-xs">Phone-assisted: call ref {m.invite.call_reference} · staff {m.invite.created_by} · notes {m.invite.call_notes ?? "—"}</p>}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-0.5 text-xs">
                {(m.events ?? []).map((e: Json) => <p key={e.id}>{dt(e.created_at)} · [{e.actor_type}] <strong>{e.event}</strong> {JSON.stringify(e.details)}</p>)}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
