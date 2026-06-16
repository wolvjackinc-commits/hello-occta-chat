import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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
import { Search, RefreshCw, Loader2, Link2, UserCheck, UserX } from "lucide-react";
import { LinkQuoteRequestDialog } from "@/components/admin/LinkQuoteRequestDialog";

const STATUS_OPTIONS = ["all", "new", "in_review", "needs_info", "assigned", "checking", "draft_quote_created", "quoted", "final_quote_ready", "expired", "rejected", "closed", "converted"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "bg-muted",
  in_review: "bg-accent text-accent-foreground",
  assigned: "bg-accent text-accent-foreground",
  checking: "bg-secondary",
  needs_info: "bg-warning text-warning-foreground",
  draft_quote_created: "bg-secondary",
  quoted: "bg-primary/70 text-primary-foreground",
  final_quote_ready: "bg-primary text-primary-foreground",
  expired: "bg-muted text-muted-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  closed: "bg-muted text-muted-foreground",
  converted: "bg-primary text-primary-foreground",
};

export const AdminQuoteRequests = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
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
    supplier_product_id: "",
    supplier_name: "",
    bucket_override_reason: "",
  });
  const [creating, setCreating] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [latestQuote, setLatestQuote] = useState<any>(null);
  const [latestSupplierProduct, setLatestSupplierProduct] = useState<any>(null);
  const [marginInfo, setMarginInfo] = useState<{ status: string; reason?: string; supplier_monthly_cost?: number | null; total_monthly_sell?: number | null; estimated_monthly_margin?: number | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [needsInfoMsg, setNeedsInfoMsg] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [speedDraft, setSpeedDraft] = useState({ download: "", upload: "", notes: "" });
  const [savingSpeeds, setSavingSpeeds] = useState(false);

  const isUuid = (value?: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const fetchSupplierProduct = async (identifier?: string | null) => {
    if (!identifier) return null;
    const select = "id, supplier_product_id, product_name, service_type, network, technology, bucket_hint, download_speed_mbps, upload_speed_mbps, min_term_months, supplier_monthly_net, supplier_setup_net, active, quote_only";
    const query = (supabase as any).from("supplier_products").select(select);
    const { data } = isUuid(identifier)
      ? await query.eq("id", identifier).maybeSingle()
      : await query.eq("supplier_product_id", identifier).maybeSingle();
    return data ?? null;
  };

  // Load active broadband supplier products when dialog opens
  const loadProducts = async () => {
    setProductsLoading(true);
    setProductsError(null);
    const { data, error } = await (supabase as any)
      .from("supplier_products")
      .select("id, supplier_product_id, product_name, service_type, network, technology, bucket_hint, download_speed_mbps, upload_speed_mbps, min_term_months, supplier_monthly_net, supplier_setup_net, active, quote_only")
      .eq("active", true)
      .order("supplier_monthly_net", { ascending: true })
      .limit(500);
    if (error) {
      setProductsError(error.message || "Could not load supplier products. Check admin RLS or supplier catalogue.");
      setProducts([]);
    } else {
      setProducts(data ?? []);
    }
    setProductsLoading(false);
  };

  // Load latest quote for selected request
  const loadLatestQuote = async (qrId: string) => {
    const { data } = await (supabase as any)
      .from("quotes")
      .select("id, quote_number, status, monthly_net, monthly_gross, plan_name, approved_at, supplier_product_id, supplier_name, customer_intent_proceeded_at, estimated_download_speed, estimated_upload_speed, speed_notes")
      .eq("quote_request_id", qrId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestQuote(data ?? null);
    setSpeedDraft({
      download: data?.estimated_download_speed != null ? String(data.estimated_download_speed) : "",
      upload: data?.estimated_upload_speed != null ? String(data.estimated_upload_speed) : "",
      notes: data?.speed_notes ?? "",
    });
    setLatestSupplierProduct(null);
    setMarginInfo(null);
    if (data?.supplier_product_id) {
      const product = await fetchSupplierProduct(data.supplier_product_id);
      setLatestSupplierProduct(product);
    }
    if (data?.id) {
      const { data: check } = await (supabase as any)
        .from("quote_margin_checks")
        .select("status, reason, supplier_monthly_cost, total_monthly_sell, estimated_monthly_margin")
        .eq("quote_id", data.id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (check) setMarginInfo(check as any);
    }
    return data ?? null;
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-quote-requests", status, search],
    queryFn: async () => {
      let q = (supabase as any)
        .from("quote_requests")
        .select("*, customer:profiles!quote_requests_customer_id_fkey(id, full_name, email, account_number)")
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

  useEffect(() => {
    if (selected?.id) { loadLatestQuote(selected.id); } else { setLatestQuote(null); setMarginInfo(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

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
      supplier_product_id: "",
      supplier_name: "",
      bucket_override_reason: "",
    });
    loadProducts();
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
        supplier_product_id: draft.supplier_product_id || null,
        supplier_name: draft.supplier_name || null,
        admin_notes: draft.bucket_override_reason ? `[BUCKET OVERRIDE] ${draft.bucket_override_reason}` : null,
      };
      const { data, error } = await supabase.functions.invoke("create-quote", { body });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: `Quote ${(data as any).quote_number} created` });
      await (supabase as any).from("quote_requests").update({ status: "draft_quote_created" }).eq("id", selected.id);
      setQuoteDialogOpen(false);
      await loadLatestQuote(selected.id);
      qc.invalidateQueries({ queryKey: ["admin-quote-requests"] });
    } catch (e: any) {
      toast({ title: "Create failed", description: e?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const runMargin = async () => {
    if (!latestQuote) { toast({ title: "Create draft first", variant: "destructive" }); return; }
    setBusy("margin");
    try {
      const freshQuote = selected?.id ? await loadLatestQuote(selected.id) : latestQuote;
      const supplierProduct = await fetchSupplierProduct(freshQuote?.supplier_product_id);
      const { data, error } = await supabase.functions.invoke("run-quote-margin-check", {
        body: { quote_id: freshQuote.id, supplier_product_id: supplierProduct?.id ?? freshQuote.supplier_product_id ?? undefined },
      });
      if (error) throw error;
      const check = (data as any)?.check;
      setMarginInfo(check ? {
        status: check.status ?? "unknown",
        reason: check.reason,
        supplier_monthly_cost: check.supplier_monthly_cost,
        total_monthly_sell: check.total_monthly_sell,
        estimated_monthly_margin: check.estimated_monthly_margin,
      } : { status: "unknown" });
      if (selected?.id) await loadLatestQuote(selected.id);
      toast({ title: `Margin: ${check?.status ?? "unknown"}`, description: check?.reason });
    } catch (e: any) {
      toast({ title: "Margin check failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const approveFinal = async () => {
    return _approveFinal();
  };
  const saveSpeeds = async () => {
    if (!latestQuote) return;
    const dl = speedDraft.download.trim() === "" ? null : Number(speedDraft.download);
    const ul = speedDraft.upload.trim() === "" ? null : Number(speedDraft.upload);
    if ((dl !== null && Number.isNaN(dl)) || (ul !== null && Number.isNaN(ul))) {
      toast({ title: "Speeds must be numeric (Mbps)", variant: "destructive" });
      return;
    }
    setSavingSpeeds(true);
    try {
      const { error } = await (supabase as any).from("quotes").update({
        estimated_download_speed: dl,
        estimated_upload_speed: ul,
        speed_notes: speedDraft.notes.trim() || null,
      }).eq("id", latestQuote.id);
      if (error) throw error;
      toast({ title: "Speeds saved — visible to customer on quote page" });
      if (selected?.id) await loadLatestQuote(selected.id);
    } catch (e: any) {
      toast({ title: "Could not save speeds", description: e?.message, variant: "destructive" });
    } finally { setSavingSpeeds(false); }
  };

  const _approveFinal = async () => {
    if (!latestQuote) return;
    // Guard: require linked supplier product + wholesale cost before approval.
    if (!latestQuote.supplier_product_id) {
      toast({ title: "Cannot approve — supplier product not linked", description: "Pick a Giacom supplier product on the draft so margin can be verified.", variant: "destructive" });
      return;
    }
    const sp = await fetchSupplierProduct(latestQuote.supplier_product_id);
    if (!sp || sp.supplier_monthly_net == null) {
      toast({ title: "Cannot approve — supplier cost missing", description: `Giacom wholesale monthly cost is missing for ${sp?.product_name ?? "this product"}. Add it in /admin/suppliers/giacom-import before approving.`, variant: "destructive" });
      return;
    }
    if (sp.active === false) {
      toast({ title: "Cannot approve — supplier product inactive", description: "Activate the product in /admin/suppliers/giacom-import first.", variant: "destructive" });
      return;
    }
    setBusy("approve");
    try {
      const { error } = await (supabase as any).rpc("admin_approve_final_quote", { _quote_id: latestQuote.id });
      if (error) throw error;
      toast({ title: "Final quote approved" });
      qc.invalidateQueries({ queryKey: ["admin-quote-requests"] });
      if (selected) await loadLatestQuote(selected.id);
    } catch (e: any) {
      toast({ title: "Approve failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const requestMoreInfo = async () => {
    if (!selected) return;
    if (needsInfoMsg.trim().length < 4) { toast({ title: "Message too short", variant: "destructive" }); return; }
    setBusy("info");
    try {
      const { error } = await (supabase as any).rpc("admin_request_more_info", { _qr_id: selected.id, _message: needsInfoMsg });
      if (error) throw error;
      toast({ title: "Customer asked for more info" });
      setNeedsInfoMsg("");
      qc.invalidateQueries({ queryKey: ["admin-quote-requests"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const rejectRequest = async () => {
    if (!selected) return;
    if (rejectReason.trim().length < 4) { toast({ title: "Reason too short", variant: "destructive" }); return; }
    setBusy("reject");
    try {
      const { error } = await (supabase as any).rpc("admin_reject_quote_request", { _qr_id: selected.id, _reason: rejectReason });
      if (error) throw error;
      toast({ title: "Request rejected" });
      setRejectReason("");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["admin-quote-requests"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
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
              <TableHead className="font-display uppercase">Email</TableHead>
              <TableHead className="font-display uppercase">Phone</TableHead>
              <TableHead className="font-display uppercase">Account</TableHead>
              <TableHead className="font-display uppercase">Service</TableHead>
              <TableHead className="font-display uppercase">Postcode</TableHead>
              <TableHead className="font-display uppercase">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No quote requests.</TableCell></TableRow>
            ) : (
              (data ?? []).map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer border-b-2 border-foreground/10 hover:bg-muted/40"
                  onClick={() => setSelectedId(r.id)}>
                  <TableCell className="text-sm">{format(new Date(r.created_at), "dd MMM HH:mm")}</TableCell>
                  <TableCell className="text-xs font-mono">{r.reference}</TableCell>
                  <TableCell className="text-sm">{r.full_name}</TableCell>
                  <TableCell className="text-xs">
                    {r.email ? (
                      <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()} className="underline hover:text-primary">{r.email}</a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="underline hover:text-primary">{r.phone}</a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.customer_id ? (
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-primary" />
                        <span className="font-mono">{r.customer?.account_number ?? "linked"}</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <UserX className="w-3 h-3" /> Guest
                      </span>
                    )}
                  </TableCell>
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
              <div className="border-2 border-foreground/20 bg-muted/40 p-2 text-xs">
                {selected.customer_id ? (
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    Linked to <strong>{selected.customer?.full_name ?? "customer"}</strong>
                    {selected.customer?.account_number && <span className="font-mono">· {selected.customer.account_number}</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4" /> Guest quote — no account linked
                  </div>
                )}
              </div>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setLinkTarget(selected); setLinkOpen(true); }}
                >
                  <Link2 className="w-4 h-4 mr-1" />
                  {selected.customer_id ? "Re-link account" : "Link to account"}
                </Button>
                <Button size="sm" variant="hero" onClick={() => openQuoteDialog(selected)}>Create quote</Button>
              </div>

              {latestQuote && (
                <div className="mt-4 border-2 border-foreground/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display uppercase text-[10px] tracking-widest">Latest draft quote</p>
                      <p className="font-mono text-xs">{latestQuote.quote_number} · {latestQuote.status}</p>
                      <p className="text-xs">{latestQuote.plan_name} · £{Number(latestQuote.monthly_gross ?? 0).toFixed(2)}/mo incl. VAT</p>
                      {latestQuote.supplier_name && <p className="text-[10px] text-muted-foreground">Supplier (internal): {latestQuote.supplier_name}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={runMargin} disabled={busy === "margin"}>
                      {busy === "margin" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Run margin check
                    </Button>
                  </div>
                  {marginInfo && (
                    <div className={`text-xs p-2 border-2 ${marginInfo.status === "green" ? "border-primary bg-primary/5" : marginInfo.status === "red" ? "border-destructive bg-destructive/5" : "border-warning bg-warning/5"}`}>
                      Margin: <strong className="uppercase">{marginInfo.status}</strong>{marginInfo.reason ? ` — ${marginInfo.reason}` : ""}
                    </div>
                  )}
                  <div className="border-2 border-foreground/20 bg-muted/40 p-2 text-[10px] space-y-1 font-mono break-all">
                    <p className="font-display uppercase tracking-widest font-normal">Supplier margin diagnostics</p>
                    <p>supplier product id: {latestQuote.supplier_product_id ?? "—"}</p>
                    <p>supplier product name: {latestSupplierProduct?.product_name ?? latestQuote.supplier_name ?? "—"}</p>
                    <p>supplier monthly cost ex VAT: {latestSupplierProduct?.supplier_monthly_net != null ? `£${Number(latestSupplierProduct.supplier_monthly_net).toFixed(2)}` : "missing"}</p>
                    <p>customer monthly ex VAT: £{Number(latestQuote.monthly_net ?? marginInfo?.total_monthly_sell ?? 0).toFixed(2)}</p>
                    <p>calculated margin ex VAT: {latestSupplierProduct?.supplier_monthly_net != null ? `£${(Number(latestQuote.monthly_net ?? 0) - Number(latestSupplierProduct.supplier_monthly_net)).toFixed(2)}` : "—"}</p>
                    <p>margin check after buffers: {marginInfo?.estimated_monthly_margin != null ? `£${Number(marginInfo.estimated_monthly_margin).toFixed(2)}` : "—"}</p>
                  </div>
                  {latestQuote.status !== "approved" && (
                    <Button size="sm" variant="hero" onClick={approveFinal} disabled={busy === "approve"}>
                      {busy === "approve" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Approve final quote
                    </Button>
                  )}
                  {latestQuote.status === "approved" && (
                    <p className="text-xs text-primary font-medium">✓ Approved {latestQuote.approved_at ? `· ${format(new Date(latestQuote.approved_at), "dd MMM HH:mm")}` : ""}</p>
                  )}
                  <div className="border-2 border-foreground/20 bg-background p-2 space-y-2">
                    <p className="font-display uppercase text-[10px] tracking-widest">Estimated speeds (shown to customer)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Download (Mbps)</Label>
                        <Input value={speedDraft.download} onChange={(e) => setSpeedDraft((p) => ({ ...p, download: e.target.value }))} inputMode="numeric" placeholder="e.g. 76" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Upload (Mbps)</Label>
                        <Input value={speedDraft.upload} onChange={(e) => setSpeedDraft((p) => ({ ...p, upload: e.target.value }))} inputMode="numeric" placeholder="e.g. 20" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Speed notes (optional, customer-safe)</Label>
                      <Textarea rows={2} value={speedDraft.notes} onChange={(e) => setSpeedDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="e.g. Estimated range based on line check." />
                    </div>
                    <Button size="sm" variant="outline" onClick={saveSpeeds} disabled={savingSpeeds}>
                      {savingSpeeds ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Save speeds
                    </Button>
                  </div>
                  {latestQuote.customer_intent_proceeded_at && (
                    <div className="border-2 border-primary bg-primary/5 p-2 text-xs">
                      ✓ Customer proceeded {format(new Date(latestQuote.customer_intent_proceeded_at), "dd MMM HH:mm")} — ready to generate Contract Summary.
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 border-2 border-foreground/20 p-3 space-y-2">
                <p className="font-display uppercase text-[10px] tracking-widest">Request more info from customer</p>
                <Textarea value={needsInfoMsg} onChange={(e) => setNeedsInfoMsg(e.target.value)} rows={2} placeholder="Customer-safe message (no internal notes)…" />
                <Button size="sm" variant="outline" onClick={requestMoreInfo} disabled={busy === "info"}>
                  {busy === "info" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Send & set Needs info
                </Button>
              </div>

              <div className="mt-4 border-2 border-foreground/20 p-3 space-y-2">
                <p className="font-display uppercase text-[10px] tracking-widest">Reject request</p>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Internal reason (audit only)…" />
                <Button size="sm" variant="outline" onClick={rejectRequest} disabled={busy === "reject"}>
                  {busy === "reject" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Reject (audit logged)
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create quote dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create quote</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Plan name</Label>
              <Input value={draft.plan_name} onChange={(e) => setDraft((p) => ({ ...p, plan_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Backend supplier product (admin-only)</Label>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search by name / speed / SKU / network…"
                className="mb-2"
              />
              <Select value={draft.supplier_product_id} onValueChange={(v) => {
                const p = products.find((x: any) => x.id === v);
                setDraft((d) => ({ ...d, supplier_product_id: v, supplier_name: p?.product_name ?? "" }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    productsLoading ? "Loading supplier products…"
                    : productsError ? "Could not load supplier products"
                    : products.length ? "Pick supplier product…"
                    : "No supplier products found. Import Giacom catalogue first."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter((p: any) => {
                      const q = productSearch.trim().toLowerCase();
                      if (!q) return true;
                      return [p.product_name, p.supplier_product_id, p.network, p.technology, p.bucket_hint, `${p.download_speed_mbps}`, `${p.upload_speed_mbps}`]
                        .filter(Boolean).some((s: string) => String(s).toLowerCase().includes(q));
                    })
                    .map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        Giacom — {p.network ?? "?"} · {p.product_name} · {p.download_speed_mbps ?? "?"}/{p.upload_speed_mbps ?? "?"}Mbps · {p.min_term_months ?? "?"}m · {p.supplier_monthly_net != null ? `£${Number(p.supplier_monthly_net).toFixed(2)} ex VAT` : "cost missing"}{p.quote_only ? " · quote-only" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {productsError && (
                <div className="mt-2 border-2 border-destructive bg-destructive/10 p-2 text-xs text-destructive">
                  Could not load supplier products. Check admin RLS or supplier catalogue. ({productsError})
                </div>
              )}
              {!productsLoading && !productsError && products.length === 0 && (
                <div className="mt-2 border-2 border-warning bg-warning/10 p-2 text-xs">
                  No active supplier products. Visit <a className="underline" href="/admin/suppliers/giacom-import">/admin/suppliers/giacom-import</a> to activate Giacom products.
                </div>
              )}
              {selected && draft.supplier_product_id && (() => {
                const sel = products.find((x: any) => x.id === draft.supplier_product_id);
                const customerBucket = String(selected?.message ?? "").match(/Build Plan:\s*([^·]+)·/)?.[1]?.trim().toLowerCase();
                const productBucket = String(sel?.bucket_hint ?? "").toLowerCase();
                if (customerBucket && productBucket && !customerBucket.includes(productBucket) && !productBucket.includes(customerBucket)) {
                  return (
                    <div className="mt-2 border-2 border-warning bg-warning/10 p-2 text-xs">
                      ⚠ Bucket override: customer chose <strong>{customerBucket}</strong> but product is <strong>{productBucket}</strong>. Reason required.
                      <Textarea className="mt-1" rows={2} value={draft.bucket_override_reason} onChange={(e) => setDraft((p) => ({ ...p, bucket_override_reason: e.target.value }))} placeholder="Reason for bucket override (audit)…" />
                    </div>
                  );
                }
                return null;
              })()}
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

      <LinkQuoteRequestDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        quoteRequestId={linkTarget?.id ?? null}
        quoteRequestEmail={linkTarget?.email ?? null}
        currentCustomerId={linkTarget?.customer_id ?? null}
        onLinked={() => qc.invalidateQueries({ queryKey: ["admin-quote-requests"] })}
      />
    </div>
  );
};

export default AdminQuoteRequests;