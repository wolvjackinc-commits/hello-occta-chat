import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Loader2, Copy, AlertTriangle, ShieldCheck, Mail, Eye } from "lucide-react";
import { CreateCSPaymentDialog } from "@/components/admin/CreateCSPaymentDialog";
import {
  AdminPageHeader,
  AdminEmptyState,
  AdminActionMenu,
  IncludeArchivedToggle,
  SafetyLabel,
} from "@/components/admin/primitives";

const STATUS_OPTIONS = ["all", "draft", "sent", "viewed", "accepted", "rejected", "expired", "converted"];

export const AdminQuotes = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [tokenDialog, setTokenDialog] = useState<{ open: boolean; quoteNumber?: string; token?: string; kind?: "quote" | "cs"; csNumber?: string }>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<{ open: boolean; quoteId?: string; quoteNumber?: string }>({ open: false });
  const [overrideReason, setOverrideReason] = useState("");
  const [payDialog, setPayDialog] = useState<{ open: boolean; csId?: string | null }>({ open: false, csId: null });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [composeDialog, setComposeDialog] = useState<{
    open: boolean;
    quoteId?: string;
    quoteNumber?: string;
    recipient?: string | null;
    customMessage: string;
    previewHtml?: string;
    previewSubject?: string;
    previewLoading?: boolean;
    sending?: boolean;
  }>({ open: false, customMessage: "" });

  const { data: vatActive } = useQuery({
    queryKey: ["is-vat-active"],
    queryFn: async () => {
      // Primary: RPC (server-side authoritative check).
      const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("is_vat_active");
      if (!rpcError && typeof rpcResult === "boolean") return rpcResult;
      // Fallback: read platform_settings directly so a missing RPC grant
      // does not force a false "VAT inactive" banner when VAT is configured.
      const { data: settings } = await (supabase as any)
        .from("platform_settings")
        .select("vat_number, vat_effective_date")
        .eq("singleton", true)
        .maybeSingle();
      if (!settings) return null; // unknown → suppress banner
      const hasNumber = typeof settings.vat_number === "string" && settings.vat_number.trim().length > 0;
      const effective = settings.vat_effective_date ? new Date(settings.vat_effective_date) : null;
      const active = hasNumber && !!effective && effective.getTime() <= Date.now();
      return active;
    },
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-quotes", status, search],
    queryFn: async () => {
      let q = (supabase as any)
        .from("quotes")
        .select(`
          id, quote_number, plan_name, service_type, plan_type, customer_type,
          monthly_net, monthly_gross, total_due_today_gross, status, expires_at, created_at,
          quote_request_id, unified_journey_opt_in,
          sent_at, opened_at, completed_at, locked_at, revision_of_quote_id
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      const term = search.trim();
      if (term) q = q.ilike("quote_number", `%${term}%`);
      const { data: rows, error } = await q;
      if (error) throw error;

      // hydrate customer info + CS status
      const reqIds = [...new Set((rows ?? []).map((r: any) => r.quote_request_id))];
      let reqMap = new Map<string, any>();
      if (reqIds.length) {
        const { data: reqs } = await (supabase as any)
          .from("quote_requests").select("id, full_name, email, reference, customer_id").in("id", reqIds);
        reqMap = new Map((reqs ?? []).map((r: any) => [r.id, r]));
      }
      const customerIds = [...new Set([
        ...(rows ?? []).map((r: any) => r.customer_id).filter(Boolean),
        ...Array.from(reqMap.values()).map((r: any) => r.customer_id).filter(Boolean),
      ])];
      let profileMap = new Map<string, any>();
      if (customerIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, account_number").in("id", customerIds);
        profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      const quoteIds = (rows ?? []).map((r: any) => r.id);
      let csMap = new Map<string, any>();
      if (quoteIds.length) {
        const { data: cs } = await (supabase as any)
          .from("contract_summaries")
          .select("id, quote_id, cs_number, status, version")
          .in("quote_id", quoteIds)
          .order("version", { ascending: false });
        (cs ?? []).forEach((c: any) => { if (!csMap.has(c.quote_id)) csMap.set(c.quote_id, c); });
      }

      // hydrate active/paid payment requests per CS (block duplicate create)
      const csIds = Array.from(csMap.values()).map((c: any) => c.id).filter(Boolean);
      let prMap = new Map<string, any>();
      if (csIds.length) {
        const { data: prs } = await (supabase as any)
          .from("payment_requests")
          .select("id, contract_summary_id, status")
          .in("contract_summary_id", csIds)
          .in("status", ["draft","pending","checkout_created","sent","opened","paid","completed"]);
        (prs ?? []).forEach((p: any) => { if (!prMap.has(p.contract_summary_id)) prMap.set(p.contract_summary_id, p); });
      }
      return (rows ?? []).map((r: any) => {
        const cs = csMap.get(r.id);
        const req = reqMap.get(r.quote_request_id);
        const profile = profileMap.get(r.customer_id) ?? (req?.customer_id ? profileMap.get(req.customer_id) : null);
        return { ...r, request: req, profile, cs, activePr: cs ? prMap.get(cs.id) : null };
      });
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = includeArchived
      ? (data ?? [])
      : (data ?? []).filter((r: any) =>
          !["expired", "rejected"].includes((r.status ?? "").toLowerCase()),
        );
    if (!term) return base;
    return base.filter((r: any) =>
      r.quote_number?.toLowerCase().includes(term) ||
      r.request?.email?.toLowerCase().includes(term) ||
      r.request?.full_name?.toLowerCase().includes(term) ||
      r.plan_name?.toLowerCase().includes(term)
    );
  }, [data, search, includeArchived]);

  const sendQuote = async (id: string, quoteNumber: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", { body: { quote_id: id, rotate_token: true } });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.message || (data as any)?.error || error?.message;
        if ((data as any)?.error === "blocked_low_margin") {
          toast({ title: "Blocked by margin guard", description: "Run a margin check and use override to send.", variant: "destructive" });
        } else {
          throw new Error(msg);
        }
        return;
      }
      toast({ title: `Quote ${quoteNumber} sent` });
      const token = (data as any)?.public_token;
      if (token) {
        setTokenDialog({ open: true, kind: "quote", token, quoteNumber });
      }
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const openComposeDialog = (id: string, quoteNumber: string) => {
    setComposeDialog({
      open: true,
      quoteId: id,
      quoteNumber,
      customMessage: "",
      previewHtml: undefined,
      previewSubject: undefined,
      recipient: null,
    });
  };

  const runPreview = async () => {
    if (!composeDialog.quoteId) return;
    setComposeDialog((s) => ({ ...s, previewLoading: true }));
    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          quote_id: composeDialog.quoteId,
          preview_only: true,
          custom_message: composeDialog.customMessage,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Preview failed");
      }
      setComposeDialog((s) => ({
        ...s,
        previewHtml: (data as any)?.html ?? "",
        previewSubject: (data as any)?.subject ?? "",
        recipient: (data as any)?.recipient ?? null,
        previewLoading: false,
      }));
    } catch (e: any) {
      toast({ title: "Preview failed", description: e?.message, variant: "destructive" });
      setComposeDialog((s) => ({ ...s, previewLoading: false }));
    }
  };

  const sendFromCompose = async () => {
    if (!composeDialog.quoteId || !composeDialog.quoteNumber) return;
    setComposeDialog((s) => ({ ...s, sending: true }));
    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          quote_id: composeDialog.quoteId,
          rotate_token: true,
          custom_message: composeDialog.customMessage,
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.message || (data as any)?.error || error?.message;
        if ((data as any)?.error === "blocked_low_margin") {
          toast({ title: "Blocked by margin guard", description: "Run a margin check and use override to send.", variant: "destructive" });
          setComposeDialog((s) => ({ ...s, sending: false }));
          return;
        }
        throw new Error(msg);
      }
      toast({ title: `Quote ${composeDialog.quoteNumber} sent` });
      const token = (data as any)?.public_token;
      setComposeDialog({ open: false, customMessage: "" });
      if (token) {
        setTokenDialog({ open: true, kind: "quote", token, quoteNumber: composeDialog.quoteNumber });
      }
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
      setComposeDialog((s) => ({ ...s, sending: false }));
    }
  };

  const runMarginCheck = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("run-quote-margin-check", { body: { quote_id: id } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const status = (data as any)?.check?.status ?? "unknown";
      toast({ title: `Margin: ${status}`, description: (data as any)?.check?.reason });
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
    } catch (e: any) {
      toast({ title: "Margin check failed", description: e?.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const submitOverride = async () => {
    if (!overrideDialog.quoteId || overrideReason.trim().length < 10) {
      toast({ title: "Reason required (10+ chars)", variant: "destructive" });
      return;
    }
    setBusyId(overrideDialog.quoteId);
    try {
      const { data, error } = await supabase.functions.invoke("override-quote-margin", {
        body: { quote_id: overrideDialog.quoteId, reason: overrideReason.trim() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Override recorded" });
      setOverrideDialog({ open: false });
      setOverrideReason("");
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
    } catch (e: any) {
      toast({ title: "Override failed", description: e?.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const generateCS = async (id: string, quoteNumber: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-summary", { body: { quote_id: id } });
      if (error || (data as any)?.error) throw new Error((data as any)?.message || (data as any)?.error || error?.message);
      const d = data as any;
      toast({ title: `CS ${d.cs_number} generated` });
      setTokenDialog({ open: true, kind: "cs", csNumber: d.cs_number, token: d.public_token, quoteNumber });
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
    } catch (e: any) {
      toast({ title: "Generate failed", description: e?.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const openPdf = async (id: string) => {
    try {
      const { data: cs } = await (supabase as any).from("contract_summaries").select("id").eq("quote_id", id).neq("status","superseded").order("version",{ascending:false}).limit(1).maybeSingle();
      if (!cs?.id) { toast({ title: "No contract summary yet", variant: "destructive" }); return; }
      const { data, error } = await supabase.functions.invoke("generate-contract-summary-pdf", { body: { contract_summary_id: cs.id } });
      if (error) throw error;
      const html = (data as any)?.html;
      if (html) {
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
      } else if ((data as any)?.url) {
        window.open((data as any).url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "PDF failed", description: e?.message, variant: "destructive" });
    }
  };

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t).then(() => toast({ title: "Copied" }));
  };

  const tokenUrl = (kind: "quote" | "cs", token: string) =>
    kind === "cs" ? `${window.location.origin}/quote/contract-summary/${token}` : `${window.location.origin}/quote/${token}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quotes"
        description="Draft, send and convert quotes to Contract Summaries."
        actions={
          <>
            <IncludeArchivedToggle
              checked={includeArchived}
              onCheckedChange={setIncludeArchived}
              label="Include expired/rejected"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-2 border-foreground"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </>
        }
      />

      {vatActive === false && (
        <Card className="border-2 border-warning bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>VAT inactive.</strong> Set VAT number and effective date in platform settings before generating
            Contract Summaries or VAT invoices.
          </div>
        </Card>
      )}

      <Card className="border-2 border-foreground p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search quote number, email, plan…" value={search}
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
              <TableHead className="font-display uppercase">Created</TableHead>
              <TableHead className="font-display uppercase">Quote</TableHead>
              <TableHead className="font-display uppercase">Customer</TableHead>
              <TableHead className="font-display uppercase">Plan</TableHead>
              <TableHead className="font-display uppercase">Monthly</TableHead>
              <TableHead className="font-display uppercase">Status</TableHead>
              <TableHead className="font-display uppercase">Sent / Opened / Done</TableHead>
              <TableHead className="font-display uppercase">CS</TableHead>
              <TableHead className="font-display uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-4">
                  <AdminEmptyState
                    title="No quotes"
                    message={
                      includeArchived
                        ? "No quotes match your search."
                        : "No live quotes. Enable ‘Include expired/rejected’ to see the full list."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow
                  key={r.id}
                  className={`border-b-2 border-foreground/10 ${
                    r.status === "accepted" || r.status === "converted"
                      ? "bg-success/15 hover:bg-success/25"
                      : ""
                  }`}
                >
                  <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm")}</TableCell>
                  <TableCell className="text-xs font-mono">{r.quote_number}</TableCell>
                  <TableCell className="text-sm">
                    <div>{r.request?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.request?.email ?? ""}</div>
                    {r.profile?.account_number && (
                      <a href={`/admin/customers/${r.profile.account_number}`} className="text-xs underline font-mono">
                        {r.profile.account_number}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.plan_name} · {r.plan_type}</TableCell>
                  <TableCell className="text-xs">
                    {r.customer_type === "business"
                      ? <>£{Number(r.monthly_net).toFixed(2)} ex<br/>£{Number(r.monthly_gross).toFixed(2)} inc</>
                      : <>£{Number(r.monthly_gross).toFixed(2)} <span className="text-muted-foreground">inc</span></>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`border-2 border-foreground capitalize ${
                        r.status === "accepted" || r.status === "converted"
                          ? "bg-success text-success-foreground"
                          : ""
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] font-mono leading-tight">
                    <div>S: {r.sent_at ? format(new Date(r.sent_at), "dd MMM HH:mm") : "—"}</div>
                    <div>O: {r.opened_at ? format(new Date(r.opened_at), "dd MMM HH:mm") : "—"}</div>
                    <div>D: {r.completed_at ? format(new Date(r.completed_at), "dd MMM HH:mm") : "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.cs ? <span className="capitalize">{r.cs.cs_number} · {r.cs.status}</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {!r.locked_at && (r.status === "draft" || r.status === "approved") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.id}
                            onClick={() => openComposeDialog(r.id, r.quote_number)}
                            title="Compose a branded email with a custom note and preview it before sending"
                            className="h-7 text-xs"
                          >
                            <Mail className="w-3 h-3 mr-1" /> Compose & send
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === r.id}
                            onClick={() => sendQuote(r.id, r.quote_number)}
                            title="Send default email now (no custom note)"
                            className="h-7 text-xs"
                          >
                            {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Quick send"}
                          </Button>
                        </>
                      )}
                      {!r.cs && (
                        <Button
                          size="sm"
                          variant="hero"
                          disabled={!vatActive || busyId === r.id}
                          onClick={() => generateCS(r.id, r.quote_number)}
                          title={!vatActive ? "VAT settings incomplete" : "Generate Contract Summary"}
                          className="h-7 text-xs"
                        >
                          {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Generate CS"}
                        </Button>
                      )}
                      {r.cs && (
                        <Button size="sm" variant="outline" onClick={() => openPdf(r.id)} className="h-7 text-xs">
                          View CS
                        </Button>
                      )}
                      {r.cs && r.cs.status === "accepted" && !r.activePr && (
                        <Button
                          size="sm"
                          variant="hero"
                          onClick={() => setPayDialog({ open: true, csId: r.cs.id })}
                          title="This will create a payment link for the customer"
                          className="h-7 text-xs"
                        >
                          Create payment link
                        </Button>
                      )}
                      {r.cs && r.cs.status === "accepted" && r.activePr && (
                        <Badge variant="outline" className="border-2 border-foreground capitalize text-xs">
                          PR: {r.activePr.status}
                        </Badge>
                      )}
                      <AdminActionMenu
                        items={[
                          {
                            label: "Run margin check",
                            icon: <ShieldCheck className="h-4 w-4" />,
                            onSelect: () => runMarginCheck(r.id),
                            disabled: busyId === r.id,
                          },
                          {
                            label: "Override red margin",
                            onSelect: () =>
                              setOverrideDialog({
                                open: true,
                                quoteId: r.id,
                                quoteNumber: r.quote_number,
                              }),
                          },
                          ...(r.locked_at
                            ? [
                                {
                                  label: "Edit & Resend (new revision)",
                                  disabled: busyId === r.id,
                                  onSelect: async () => {
                                    setBusyId(r.id);
                                    try {
                                      const { data, error } = await supabase.functions.invoke(
                                        "edit-and-resend-quote",
                                        { body: { source_quote_id: r.id } },
                                      );
                                      const err = (data as any)?.error || error?.message;
                                      if (err) throw new Error(err);
                                      toast({
                                        title: `Revision ${(data as any).quote_number} created`,
                                      });
                                      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
                                    } catch (e: any) {
                                      toast({
                                        title: "Revision failed",
                                        description: e?.message,
                                        variant: "destructive",
                                      });
                                    } finally {
                                      setBusyId(null);
                                    }
                                  },
                                },
                              ]
                            : []),
                          { type: "separator" as const },
                          {
                            label: r.unified_journey_opt_in
                              ? "Disable unified journey"
                              : "Enable unified journey",
                            disabled: busyId === r.id,
                            onSelect: async () => {
                              setBusyId(r.id);
                              try {
                                const next = !r.unified_journey_opt_in;
                                const { error } = await (supabase as any).rpc(
                                  "admin_set_quote_unified_opt_in",
                                  { _quote_id: r.id, _enabled: next },
                                );
                                if (error) throw error;
                                toast({
                                  title: next
                                    ? "Unified journey enabled"
                                    : "Unified journey disabled",
                                });
                                await qc.invalidateQueries({ queryKey: ["admin-quotes"] });
                              } catch (e: any) {
                                toast({
                                  title: "Toggle failed",
                                  description: e?.message,
                                  variant: "destructive",
                                });
                              } finally {
                                setBusyId(null);
                              }
                            },
                          },
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Token reveal dialog (one-time) */}
      <Dialog open={tokenDialog.open} onOpenChange={(o) => setTokenDialog({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tokenDialog.kind === "cs" ? `Contract Summary ${tokenDialog.csNumber}` : `Quote ${tokenDialog.quoteNumber}`} — secure link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This link is shown <strong>once</strong>. It was emailed automatically to the customer. Copy it
              now if you also need it for your records — we don't store the raw token.
            </p>
            {tokenDialog.token && (
              <div className="border-2 border-foreground p-3 break-all font-mono text-xs flex gap-2 items-start">
                <span className="flex-1">{tokenUrl(tokenDialog.kind ?? "quote", tokenDialog.token)}</span>
                <Button size="sm" variant="outline" onClick={() => copyText(tokenUrl(tokenDialog.kind ?? "quote", tokenDialog.token!))}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setTokenDialog({ open: false })}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Margin override dialog */}
      <Dialog open={overrideDialog.open} onOpenChange={(o) => setOverrideDialog({ open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Override low-margin block — {overrideDialog.quoteNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Admin/super-admin only. Provide a clear business reason (10+ characters). This will be logged.</p>
            <textarea
              className="w-full border-2 border-foreground p-2 text-sm min-h-[100px]"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Strategic discount approved by..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideDialog({ open: false }); setOverrideReason(""); }}>Cancel</Button>
            <Button variant="hero" onClick={submitOverride}>Record override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCSPaymentDialog
        open={payDialog.open}
        onOpenChange={(o) => { setPayDialog({ open: o, csId: o ? payDialog.csId : null }); if (!o) qc.invalidateQueries({ queryKey: ["admin-quotes"] }); }}
        contractSummaryId={payDialog.csId ?? null}
      />

      {/* Compose & preview quote email */}
      <Dialog
        open={composeDialog.open}
        onOpenChange={(o) => setComposeDialog((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Compose quote email — {composeDialog.quoteNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-2">
                Custom note to customer <span className="text-muted-foreground font-normal normal-case tracking-normal">(optional — appears above quote details)</span>
              </label>
              <textarea
                className="w-full border-2 border-foreground p-3 text-sm min-h-[140px] font-sans"
                value={composeDialog.customMessage}
                onChange={(e) => setComposeDialog((s) => ({ ...s, customMessage: e.target.value, previewHtml: undefined }))}
                placeholder="e.g. Hi Sam — following our call today, here's the updated quote. I've included the router upgrade we discussed. Any questions just reply to this email."
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Plain text only. Blank lines create paragraphs. HTML is escaped for safety.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runPreview}
                disabled={composeDialog.previewLoading || composeDialog.sending}
              >
                {composeDialog.previewLoading
                  ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Rendering…</>
                  : <><Eye className="w-3 h-3 mr-1" /> Preview email</>}
              </Button>
              {composeDialog.recipient && (
                <span className="text-xs self-center text-muted-foreground">
                  Recipient: <strong className="text-foreground">{composeDialog.recipient}</strong>
                </span>
              )}
            </div>

            {composeDialog.previewHtml !== undefined && (
              <div className="border-2 border-foreground">
                <div className="bg-muted px-3 py-2 border-b-2 border-foreground text-xs font-black uppercase tracking-wider">
                  Subject: <span className="normal-case tracking-normal font-mono">{composeDialog.previewSubject}</span>
                </div>
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={composeDialog.previewHtml}
                  className="w-full h-[500px] bg-white"
                />
                <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border">
                  The secure quote link shown here is a placeholder. A fresh one-time-use link is generated when you press Send.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="pt-3 border-t-2 border-foreground">
            <Button
              variant="outline"
              onClick={() => setComposeDialog({ open: false, customMessage: "" })}
              disabled={composeDialog.sending}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              onClick={sendFromCompose}
              disabled={composeDialog.sending || composeDialog.previewLoading}
            >
              {composeDialog.sending
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending…</>
                : <><Mail className="w-3 h-3 mr-1" /> Send & lock quote</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminQuotes;