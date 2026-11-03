import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { careAdmin, dd, dt, gbp, REVIEW_LABEL, STATUS_TONE, type Json } from "@/lib/care/admin";
import { MemberDialog } from "@/components/admin/care/MemberDialog";
import { DirectDebitPanel } from "@/components/admin/care/DirectDebitPanel";
import { DisputesPanel, LettersPanel, PhoneSalePanel, RefundsPanel, ReportsPanel, SettingsPanel } from "@/components/admin/care/OpsPanels";
import { CARE_BANNED_PHRASES, CARE_PHONE_SCRIPT } from "../../../supabase/functions/_shared/careTerms.ts";

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`border-[3px] p-3 ${warn ? "border-destructive" : "border-foreground"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}

export default function AdminCare() {
  const { toast } = useToast();
  const [o, setO] = useState<Json | null>(null);
  const [tab, setTab] = useState("members");
  const [filter, setFilter] = useState("live");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Json[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const [ov, list] = await Promise.all([careAdmin.overview(), careAdmin.list(filter, search.trim() || null)]);
      setO(ov); setRows(list ?? []);
    } catch (e) { toast({ title: "Couldn't load OCCTA Care", description: String((e as Error).message), variant: "destructive" }); }
  }, [filter, search, toast]);
  useEffect(() => { void load(); }, [load, tick]);
  const changed = useCallback(() => setTick((t) => t + 1), []);

  const m = o?.members ?? {};
  const live = (m.active ?? 0) + (m.pending_mandate ?? 0) + (m.cancel_pending ?? 0);

  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase">OCCTA Care</h1>
          <p className="text-sm text-muted-foreground">Support subscription, not insurance. Own Direct Debit (APS Re OCCTA · OCCTA CARE- references). Every action is logged on the member's timeline.</p>
        </div>
        <div className="flex gap-2"><Button asChild><a href="/staff/care-sales">Sales Desk</a></Button><Button variant="outline" onClick={changed}><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button></div>
      </div>

      {o && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Live members" value={live} />
          <Stat label="Monthly revenue (est.)" value={gbp(o.monthly_revenue_minor)} />
          <Stat label="Reviews waiting" value={o.reviews} warn={o.reviews > 0} />
          <Stat label="Mandates to lodge / cancel" value={`${o.mandates_to_lodge} / ${o.mandates_to_cancel}`} warn={o.mandates_to_lodge + o.mandates_to_cancel > 0} />
          <Stat label="Collections ready / awaiting result" value={`${o.collections_ready} / ${o.collections_awaiting_result}`} />
          <Stat label="Open disputes" value={o.open_disputes} warn={o.open_disputes > 0} />
          <Stat label="Refunds to pay" value={gbp(o.refunds_to_pay)} warn={o.refunds_to_pay > 0} />
          <Stat label="Letters to print" value={o.letters_to_print} warn={o.letters_to_print > 0} />
          <Stat label="Failed messages" value={o.outbox_failed} warn={o.outbox_failed > 0} />
          <Stat label="Sign-ups" value={o.settings?.sales_open ? "OPEN" : "CLOSED"} warn={!o.settings?.sales_open} />
          <Stat label="Paused" value={m.paused ?? 0} />
          <Stat label="Cancelled" value={m.cancelled ?? 0} />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="dd">Direct Debit</TabsTrigger>
          <TabsTrigger value="disputes">Disputes{o?.open_disputes ? ` (${o.open_disputes})` : ""}</TabsTrigger>
          <TabsTrigger value="letters">Letters{o?.letters_to_print ? ` (${o.letters_to_print})` : ""}</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="phone">Sell by phone</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="playbook">Staff playbook</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[["live", "Live"], ["review", "Needs review"], ["paused", "Paused"], ["low_use", "Low use (6 mo)"], ["ended", "Ended"], ["all", "All"]].map(([k, l]) => (
              <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l}</Button>
            ))}
            <Input className="max-w-xs" placeholder="Search name, account, email, postcode, reference" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") changed(); }} />
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Customer</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Mandate</TableHead><TableHead>Joined</TableHead><TableHead>Last used</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">No members here yet.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
                  <TableCell className="font-mono text-xs">{r.reference}{r.is_test ? " (test)" : ""}</TableCell>
                  <TableCell className="text-xs">{r.full_name}<br />{r.account_number} · {r.postcode}</TableCell>
                  <TableCell className="text-xs">{r.plan_code} · {r.frequency} · {gbp(r.price_minor)}</TableCell>
                  <TableCell><Badge variant={STATUS_TONE[r.status] ?? "outline"}>{r.status}</Badge>{(r.review_reasons ?? []).map((x: string) => <Badge key={x} variant="outline" className="ml-1">{REVIEW_LABEL[x] ?? x}</Badge>)}</TableCell>
                  <TableCell className="text-xs">{r.mandate_status}</TableCell>
                  <TableCell className="text-xs">{dt(r.joined_at)}<br />{r.channel}</TableCell>
                  <TableCell className="text-xs">{r.last_used ? dd(r.last_used) : "never"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="dd"><DirectDebitPanel onOpenMember={setOpen} onChanged={changed} /></TabsContent>
        <TabsContent value="disputes"><DisputesPanel onOpenMember={setOpen} onChanged={changed} /></TabsContent>
        <TabsContent value="letters"><LettersPanel onChanged={changed} /></TabsContent>
        <TabsContent value="refunds"><RefundsPanel onOpenMember={setOpen} onChanged={changed} /></TabsContent>
        <TabsContent value="phone"><PhoneSalePanel onChanged={changed} /></TabsContent>
        <TabsContent value="reports"><ReportsPanel /></TabsContent>
        <TabsContent value="settings"><SettingsPanel overview={o} onChanged={changed} /></TabsContent>

        <TabsContent value="playbook" className="max-w-3xl space-y-5 text-sm">
          <section>
            <h2 className="font-display text-xl uppercase">Every working day</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Reviews: call the customer, then approve or decline. Pauses for 75+ must run their 48 hours.</li>
              <li>Direct Debit → mandates: lodge new Care mandates in AccessPay (reference OCCTA CARE-…) and mark them lodged, then active. Cancel any marked "cancel requested".</li>
              <li>Import today's AccessPay reports: record each Care collection as paid (with the date the money arrived) or returned (ARUDD code); record ADDACS cancellations and DDICA indemnity claims.</li>
              <li>Collections → ready: create a run, upload the CSV to AccessPay, confirm submitted.</li>
              <li>Letters → to print: print the batch, post it, mark posted with today's date. Post Braille and carer copies by hand.</li>
              <li>Refunds → pay anything due by bank transfer and record the reference.</li>
              <li>Disputes: anything with 2 days or less left is today's job.</li>
            </ol>
          </section>
          <section>
            <h2 className="font-display text-xl uppercase">What Care is, in one line</h2>
            <p>A support service, not insurance. It never pays for, repairs or replaces a customer's own device. Faulty OCCTA kit is replaced for every customer within 5 working days (it's their legal right); Care Plus makes it next working day. Essentials doesn't change the swap time.</p>
            <p className="mt-2">Never say: {CARE_BANNED_PHRASES.map((b) => `"${b}"`).join(", ")}. Say: support, help, setup, data transfer, faster OCCTA kit swaps (Care Plus). Don't offer repairs: Care has no repair partner yet.</p>
          </section>
          <section>
            <h2 className="font-display text-xl uppercase">Phone script (Sell by phone tab)</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">{CARE_PHONE_SCRIPT.map((l) => <li key={l.id}>{l.line}</li>)}</ul>
            <p className="mt-2">No cold calls. No deadlines or "today only". Don't sell to anyone confused, under pressure from someone else, or worried about money. We never take bank details over the phone for Care.</p>
          </section>
          <section>
            <h2 className="font-display text-xl uppercase">Cancelling</h2>
            <p>Accept every cancellation by any channel, the same day, with at most one "is there anything we can fix?". Use Cancel in the member's record and pick the channel. The customer gets written confirmation automatically.</p>
          </section>
          <section>
            <h2 className="font-display text-xl uppercase">Complaints and disputes</h2>
            <p>Log it from the member's record (it goes into Support → Complaints). Open the evidence pack. Decide within 5 working days. If any rule was missed, or the customer may be vulnerable: refund and cancel. A £5 dispute is never worth an argument. Care debts are never chased and never go to a debt collector.</p>
          </section>
          <section>
            <h2 className="font-display text-xl uppercase">Vulnerable customers</h2>
            <p>Signs: bereavement, illness, confusion, money worries, someone else answering for them. Pause the sale or cancel free. Record support needs only with consent (it's special category data). Carers or attorneys can act once their authority is on the account.</p>
          </section>
        </TabsContent>
      </Tabs>

      <MemberDialog id={open} onClose={() => setOpen(null)} onChanged={changed} />
    </div>
  );
}
