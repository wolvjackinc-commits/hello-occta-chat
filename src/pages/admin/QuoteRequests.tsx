import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Loader2 } from "lucide-react";

const STATUS_OPTIONS = ["all", "new", "assigned", "checking", "quoted", "expired", "rejected", "converted"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary text-primary-foreground",
  assigned: "bg-accent text-accent-foreground",
  checking: "bg-secondary",
  quoted: "bg-primary/70 text-primary-foreground",
  expired: "bg-muted text-muted-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  converted: "bg-primary text-primary-foreground",
};

export const AdminQuoteRequests = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [draft, setDraft] = useState({
    plan_name: "",
    monthly_net: "",
    setup_net: "0",
    router_net: "0",
    plan_type: "flex" as "flex" | "contract_saver",
    contract_length_months: "",
    expires_in_days: "14",
    customer_notes: "",
  });
  const [creating, setCreating] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-quote-requests", status, search],
    queryFn: async () => {
      let q = (supabase as any)
        .from("quote_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      const term = search.trim();
      if (term) {
        q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,postcode.ilike.%${term}%,reference.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = useMemo(
    () => (data ?? []).find((r: any) => r.id === selectedId) ?? null,
    [data, selectedId],
  );

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await (supabase as any)
      .from("quote_requests").update({ status: newStatus }).eq("id", id);
    if (error) { toast({ title: "Update failed", variant: "destructive" }); return; }
    toast({ title: `Marked ${newStatus}` });
    qc.invalidateQueries({ queryKey: ["admin-quote-requests"] });
  };

  const assignToMe = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) { toast({ title: "Not authenticated", variant: "destructive" }); return; }
    const { error } = await (supabase as any)
      .from("quote_requests").update({ assigned_admin_id: uid, status: "assigned" }).eq("id", id);
    if (error) { toast({ title: "Assign failed", variant: "destructive" }); return; }
    toast({ title: "Assigned to you" });
    qc.invalidateQueries({ queryKey: ["admin-quote-requests"] });
  };

  const openQuoteDialog = (qr: any) => {
    setDraft({
      plan_name: qr.plan_preference === "contract_saver" ? "Contract Saver" : "Flex",
      monthly_net: "",
      setup_net: "0",
      router_net: "0",
      plan_type: qr.plan_preference === "contract_saver" ? "contract_saver" : "flex",
      contract_length_months: qr.plan_preference === "contract_saver" ? "12" : "",
      expires_in_days: "14",
      customer_notes: "",
    });
    setQuoteDialogOpen(true);
  };

  const createQuote = async () => {
    if (!selected) return;
    if (!draft.plan_name || !draft.monthly_net) {
      toast({ title: "Plan name and monthly net required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const body = {
        quote_request_id: selected.id,
        plan_name: draft.plan_name,
        service_type: selected.service_interest,
        plan_type: draft.plan_type,
        customer_type: selected.customer_type,
        monthly_net: Number(draft.monthly_net),
        setup_net: Number(draft.setup_net || 0),
        router_net: Number(draft.router_net || 0),
        delivery_net: 0,
        installation_net: 0,
        contract_length_months: draft.plan_type === "contract_saver"
          ? Number(draft.contract_length_months || 12) : null,
        expires_in_days: Number(draft.expires_in_days || 14),
        customer_notes: draft.customer_notes || null,
      };
      const { data, error } = await supabase.functions.invoke("create-quote", { body });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: `Quote ${(data as any).quote_number} created` });
      setQuoteDialogOpen(false);
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["admin-quote-requests"] });
    } catch (e: any) {
      toast({ title: "Create failed", description: e?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Quote Requests</h1>
          <p className="text-muted-foreground">Incoming quote requests from the website.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="border-2 border-foreground">
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card className="border-2 border-foreground p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name, email, postcode, ref…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9 border-2 border-foreground" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44 border-2 border-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-2 border-foreground overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-4 border-foreground bg-muted/50">
              <TableHead className="font-display uppercase">Received</TableHead>
              <TableHead className="font-display uppercase">Reference</TableHead>
              <TableHead className="font-display uppercase">Name</TableHead>
              <TableHead className="font-display uppercase">Service</TableHead>
              <TableHead className="font-display uppercase">Postcode</TableHead>
              <TableHead className="font-display uppercase">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No quote requests.</TableCell></TableRow>
            ) : (
              (data ?? []).map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer border-b-2 border-foreground/10 hover:bg-muted/40"
                  onClick={() => setSelectedId(r.id)}>
                  <TableCell className="text-sm">{format(new Date(r.created_at), "dd MMM HH:mm")}</TableCell>
                  <TableCell className="text-xs font-mono">{r.reference}</TableCell>
                  <TableCell className="text-sm">{r.full_name}</TableCell>
                  <TableCell className="text-xs">{r.service_interest} · {r.customer_type}</TableCell>
                  <TableCell className="text-xs font-mono">{r.postcode}</TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_COLORS[r.status] ?? "bg-muted"} border-2 border-foreground capitalize`}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display uppercase">{selected?.reference}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Customer</p>
                <p className="font-medium">{selected.full_name}</p>
                <p className="text-muted-foreground">{selected.email} · {selected.phone}</p>
                {selected.business_name && <p className="text-muted-foreground">Business: {selected.business_name}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Address</p>
                <p>{[selected.address_line_1, selected.address_line_2, selected.town, selected.county, selected.postcode].filter(Boolean).join(", ")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground uppercase">Service</p><p>{selected.service_interest}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Plan pref</p><p>{selected.plan_preference}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Customer type</p><p>{selected.customer_type}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Preferred contact</p><p>{selected.preferred_contact_method}</p></div>
              </div>
              {selected.current_provider && (
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground uppercase">Current provider</p><p>{selected.current_provider}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase">Current bill</p><p>{selected.current_monthly_bill ? `£${selected.current_monthly_bill}` : "—"}</p></div>
                </div>
              )}
              {selected.message && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Message</p>
                  <p className="whitespace-pre-wrap">{selected.message}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-4 border-t-2 border-foreground/20">
                {selected.status === "new" && (
                  <Button size="sm" variant="outline" onClick={() => assignToMe(selected.id)}>Assign to me</Button>
                )}
                {selected.status !== "checking" && selected.status !== "quoted" && selected.status !== "converted" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(selected.id, "checking")}>Mark checking</Button>
                )}
                {selected.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(selected.id, "rejected")}>Reject</Button>
                )}
                <Button size="sm" variant="hero" onClick={() => openQuoteDialog(selected)}>Create quote</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create quote dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create quote</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Plan name</Label>
              <Input value={draft.plan_name} onChange={(e) => setDraft((p) => ({ ...p, plan_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plan type</Label>
                <Select value={draft.plan_type} onValueChange={(v) => setDraft((p) => ({ ...p, plan_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flex">Flex</SelectItem>
                    <SelectItem value="contract_saver">Contract Saver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.plan_type === "contract_saver" && (
                <div>
                  <Label className="text-xs">Term (months)</Label>
                  <Input value={draft.contract_length_months} onChange={(e) => setDraft((p) => ({ ...p, contract_length_months: e.target.value }))} inputMode="numeric" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Monthly £ (ex VAT)</Label><Input value={draft.monthly_net} onChange={(e) => setDraft((p) => ({ ...p, monthly_net: e.target.value }))} inputMode="decimal" /></div>
              <div><Label className="text-xs">Setup £ (ex VAT)</Label><Input value={draft.setup_net} onChange={(e) => setDraft((p) => ({ ...p, setup_net: e.target.value }))} inputMode="decimal" /></div>
              <div><Label className="text-xs">Router £ (ex VAT)</Label><Input value={draft.router_net} onChange={(e) => setDraft((p) => ({ ...p, router_net: e.target.value }))} inputMode="decimal" /></div>
            </div>
            <div>
              <Label className="text-xs">Expires in (days)</Label>
              <Input value={draft.expires_in_days} onChange={(e) => setDraft((p) => ({ ...p, expires_in_days: e.target.value }))} inputMode="numeric" />
            </div>
            <div>
              <Label className="text-xs">Customer notes</Label>
              <Textarea value={draft.customer_notes} onChange={(e) => setDraft((p) => ({ ...p, customer_notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={createQuote} disabled={creating}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminQuoteRequests;