import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Reward = { id: string; order_id: string; customer_id: string; status: string; version: number;
  reward_amount: number; eligibility_due_at: string | null; payout_reference: string | null;
  blocked_reason: string | null; manual_hold: boolean; needs_review: boolean };
type History = { id: number; event_type: string; created_at: string; actor_id: string | null; from_status: string | null; to_status: string | null; details: unknown };
type Message = { id: string; template: string; status: string; attempts: number; last_error: string | null };
type Action = "queue_payout" | "mark_issued" | "block" | "release" | "reverse";
type Selection = { reward: Reward; action: Action; requestId: string };
type Result = { ok: boolean; error?: string; rewards?: Reward[]; total?: number; can_admin?: boolean; failed_messages?: number; events?: History[]; messages?: Message[] };

async function call(body: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.functions.invoke("switch50-admin", { body });
  if (error || !data?.ok) {
    const payload = error?.context instanceof Response ? await error.context.json().catch(() => null) : data;
    throw new Error(payload?.error ?? "Unable to confirm the operation. Refresh before retrying.");
  }
  return data;
}
const labels: Record<Action,string> = { queue_payout: "Queue payment", mark_issued: "Record completed transfer",
  block: "Place on hold", release: "Release and recheck", reverse: "Record cash recovery" };
const statuses = ["all","pending","eligible","payout_queued","issued","blocked","reversed","expired"];
export function Switch50PayoutPanel() {
  const [items,setItems]=useState<Reward[]>([]),[status,setStatus]=useState("all"),[page,setPage]=useState(0);
  const [total,setTotal]=useState(0),[canAdmin,setCanAdmin]=useState(false),[failed,setFailed]=useState(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[selection,setSelection]=useState<Selection|null>(null);
  const [reference,setReference]=useState(""),[reason,setReason]=useState("");
  const [history,setHistory]=useState<{reward:Reward;events:History[];messages:Message[]}|null>(null);
  const load=useCallback(async()=>{
    setBusy(true);setError("");
    try { const r=await call({action:"status",status,page});setItems(r.rewards??[]);setTotal(r.total??0);setCanAdmin(!!r.can_admin);setFailed(r.failed_messages??0); }
    catch(e){setError(e instanceof Error?e.message:"Unable to load payouts");}
    finally{setBusy(false);}
  },[status,page]);
  useEffect(()=>{void load()},[load]);
  function choose(reward:Reward,action:Action){setSelection({reward,action,requestId:crypto.randomUUID()});setReference("");setReason("");setError("");}
  async function submit(){
    if(!selection)return;
    setBusy(true);setError("");
    try {
      await call({action:selection.action,reward_id:selection.reward.id,expected_version:selection.reward.version,
        request_id:selection.requestId,reason:reason.trim()||undefined,payout_reference:reference.trim()||undefined});
      setSelection(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to confirm the change");}finally{setBusy(false);}
  }
  async function inspect(reward:Reward){
    setBusy(true);setError("");
    try{const r=await call({action:"history",reward_id:reward.id});setHistory({reward,events:r.events??[],messages:r.messages??[]});}
    catch(e){setError(e instanceof Error?e.message:"Unable to load history");}finally{setBusy(false);}
  }
  const needsReference=selection && ["mark_issued","reverse"].includes(selection.action);
  const needsReason=selection && ["block","release","reverse"].includes(selection.action);
  return <section className="space-y-4 border-4 border-foreground p-4" aria-label="SWITCH50 cash payouts">
    <h2 className="font-display text-2xl uppercase">SWITCH50 cash payouts</h2>
    <p className="text-sm text-muted-foreground">Verify the recipient through the approved finance process, make the bank transfer, then record its reference here. These controls record payments; they do not send money. Eligibility is checked again before a transfer can be recorded.</p>
    {failed>0 && <p role="alert" className="text-destructive">{failed} customer messages need delivery review. Open reward history for details.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <label>Status <select className="ml-2 border-2 p-2 bg-background" value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}}>{statuses.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select></label>
      <Button variant="outline" disabled={busy} onClick={()=>void load()}>Refresh</Button>
      <Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{await call({action:"evaluate"});await load()}catch(e){setError(e instanceof Error?e.message:"Evaluation failed")}finally{setBusy(false)}}}>Check eligibility</Button>
    </div>
    <p className="text-xs text-muted-foreground sm:hidden">Scroll the table sideways to see payment actions.</p>
    <div className="overflow-x-auto" tabIndex={0} aria-label="Scrollable payout table" aria-busy={busy}>
      <table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b-2">
        {["Order","Amount","Status","Eligibility date","Transfer reference","Actions"].map(t=><th key={t} className="p-2 text-left">{t}</th>)}
      </tr></thead><tbody>{items.map(r=><tr key={r.id} className="border-b">
        <td className="p-2 font-mono text-xs"><button className="underline" disabled={busy} title={r.order_id} onClick={()=>void inspect(r)}>{r.order_id.slice(0,8)}…</button></td>
        <td className="p-2">£{Number(r.reward_amount).toFixed(2)}</td>
        <td className="p-2">{r.status.replace(/_/g," ")}{r.needs_review && <strong className="block text-destructive">Payment needs review</strong>}{r.blocked_reason && <span className="block text-xs text-muted-foreground">{r.blocked_reason.replace(/_/g," ")}</span>}</td>
        <td className="p-2">{r.eligibility_due_at?new Date(r.eligibility_due_at).toLocaleDateString("en-GB"):"Awaiting activation"}</td>
        <td className="p-2">{r.payout_reference??"—"}</td>
        <td className="p-2"><div className="flex flex-wrap gap-2">
          {r.status==="eligible" && <Button size="sm" disabled={busy} onClick={()=>choose(r,"queue_payout")}>Queue payment</Button>}
          {r.status==="payout_queued" && <Button size="sm" disabled={busy} onClick={()=>choose(r,"mark_issued")}>Record transfer</Button>}
          {canAdmin && ["pending","eligible","payout_queued"].includes(r.status) && <Button size="sm" variant="outline" disabled={busy} onClick={()=>choose(r,"block")}>Hold</Button>}
          {canAdmin && r.status==="blocked" && r.manual_hold && <Button size="sm" variant="outline" disabled={busy} onClick={()=>choose(r,"release")}>Release</Button>}
          {canAdmin && r.status==="issued" && <Button size="sm" variant="outline" disabled={busy} onClick={()=>choose(r,"reverse")}>Record recovery</Button>}
          <Button size="sm" variant="outline" disabled={busy} onClick={()=>void inspect(r)}>History</Button>
        </div></td></tr>)}
        {!items.length && <tr><td colSpan={6} className="p-6 text-center">{busy?"Loading…":"No rewards in this status."}</td></tr>}
      </tbody></table>
    </div>
    <div className="flex items-center gap-3"><Button variant="outline" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous</Button>
      <span>Page {page+1} · {total} rewards</span><Button variant="outline" disabled={busy||(page+1)*50>=total} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
    <Dialog open={!!selection} onOpenChange={o=>{if(!o&&!busy)setSelection(null)}}>
      <DialogContent><DialogHeader><DialogTitle>{selection?labels[selection.action]:"Reward action"}</DialogTitle>
        <DialogDescription>£{Number(selection?.reward.reward_amount??0).toFixed(2)} · Order {selection?.reward.order_id}. Every change is audited.</DialogDescription></DialogHeader>
        {needsReference && <><p className="text-sm">{selection?.action==="reverse"?"Confirm that the money has been recovered and enter the recovery reference.":"Confirm that the bank transfer has completed and enter its reference."}</p><label>Bank reference<Input maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label></>}
        {needsReason && <label>Reason<Textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setSelection(null)}>Cancel</Button><Button disabled={busy||!!(needsReference&&reference.trim().length<4)||!!(needsReason&&reason.trim().length<10)} onClick={()=>void submit()}>Confirm</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!history} onOpenChange={o=>{if(!o)setHistory(null)}}>
      <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>SWITCH50 history</DialogTitle><DialogDescription>Order {history?.reward.order_id}</DialogDescription></DialogHeader>
        <h3 className="font-semibold">Customer messages</h3><ul className="space-y-2">{history?.messages.map(m=><li key={m.id} className="text-sm">{m.template.replace(/_/g," ")} · {m.status} · {m.attempts} attempts{m.last_error&&<p className="text-destructive">{m.last_error}</p>}</li>)}</ul>
        <h3 className="font-semibold">Audit events</h3><ol className="space-y-3">{history?.events.map(e=><li key={e.id} className="text-sm border-b pb-2">
          <b>{e.event_type.replace(/_/g," ")}</b><p>{new Date(e.created_at).toLocaleString("en-GB")} · {e.actor_id??"Automatic"}</p>
          <p>{e.from_status??"created"} → {e.to_status??"recorded"}</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(e.details,null,2)}</pre>
        </li>)}</ol>
      </DialogContent>
    </Dialog>
  </section>;
}
