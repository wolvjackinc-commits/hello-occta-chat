import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, Plus, RefreshCw } from "lucide-react";
import { logError } from "@/lib/logger";

const STATUS_OPTIONS = [
  "ready_for_manual_order",
  "order_entered_in_supplier_portal",
  "supplier_acknowledged",
  "installation_pending",
  "active",
  "cancelled",
] as const;

type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_LABEL: Record<Status, string> = {
  ready_for_manual_order: "Ready for manual order",
  order_entered_in_supplier_portal: "Entered in supplier portal",
  supplier_acknowledged: "Supplier acknowledged",
  installation_pending: "Installation pending",
  active: "Active",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<Status, string> = {
  ready_for_manual_order: "bg-muted text-foreground",
  order_entered_in_supplier_portal: "bg-accent/20 text-foreground",
  supplier_acknowledged: "bg-primary/20 text-foreground",
  installation_pending: "bg-warning/20 text-foreground",
  active: "bg-success/20 text-foreground",
  cancelled: "bg-destructive/20 text-foreground",
};

type Tracker = {
  id: string;
  status: Status;
  account_number: string | null;
  customer_id: string | null;
  payment_request_id: string;
  contract_summary_id: string;
  selected_product_label: string | null;
  supplier_name: string | null;
  supplier_product_ref: string | null;
  supplier_portal_reference: string | null;
  notes: string | null;
  readiness_confirmed: boolean;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  cancelled_at: string | null;
};

type EligiblePR = {
  id: string;
  payment_request_number: string | null;
  amount: number | null;
  currency: string;
  customer_name: string;
  customer_email: string;
  account_number: string | null;
  user_id: string | null;
  contract_summary_id: string | null;
  paid_at: string | null;
  contract_summaries: {
    id: string;
    cs_number: string;
    plan_name: string;
    accepted_at: string | null;
    pdf_url: string | null;
  } | null;
};

export default function ManualFulfilment() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const trackersQ = useQuery({
    queryKey: ["manual-fulfilment", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("manual_fulfilment_orders" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") {
        q = (q as any).eq("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Tracker[]) ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight">
            Manual Fulfilment
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Track supplier orders entered manually in supplier portals. This
            page never calls supplier APIs and never creates services,
            invoices, DD mandates, or provisioning rows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as never)}>
            <SelectTrigger className="w-[220px] border-2 border-foreground">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => trackersQ.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New tracker
          </Button>
        </div>
      </div>

      <div className="border-2 border-foreground bg-card">
        <div className="border-b-2 border-foreground bg-warning/10 px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Manual fulfilment only.</strong> Creating or updating a
            tracker here will NOT submit anything to a supplier, activate a
            service, create an invoice, or set up Direct Debit. Use the
            supplier&apos;s own portal to place orders.
          </div>
        </div>

        {trackersQ.isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : trackersQ.isError ? (
          <div className="p-6 text-sm text-destructive">
            Failed to load trackers.
          </div>
        ) : (trackersQ.data?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
            <div className="font-display uppercase text-base text-foreground">No manual fulfilment trackers yet</div>
            <div>
              Trackers appear here once a payment request is <strong>paid and webhook-verified</strong> with an accepted Contract Summary.
              Click <strong>New tracker</strong> to start one — supplier orders are still placed in the supplier&apos;s own portal.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Portal ref</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[200px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackersQ.data!.map((t) => (
                  <TrackerRow key={t.id} tracker={t} onChanged={() => qc.invalidateQueries({ queryKey: ["manual-fulfilment"] })} toast={toast} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateTrackerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["manual-fulfilment"] })}
      />
    </div>
  );
}

function TrackerRow({
  tracker,
  onChanged,
  toast,
}: {
  tracker: Tracker;
  onChanged: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [busy, setBusy] = useState(false);

  const updateStatus = async (next: Status) => {
    if (next === tracker.status) return;
    if (next === "active") {
      const ok = window.confirm(
        "Mark this tracker as ACTIVE? This is a tracker-only status change. It will NOT create a service row, invoice, or DD. Continue?"
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("manual_fulfilment_orders" as never)
        .update({ status: next } as never)
        .eq("id", tracker.id);
      if (error) throw error;
      toast({ title: `Status updated to ${STATUS_LABEL[next]}` });
      onChanged();
    } catch (e) {
      logError("ManualFulfilment.updateStatus", e);
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        {tracker.account_number ?? "—"}
      </TableCell>
      <TableCell className="text-sm">{tracker.selected_product_label ?? "—"}</TableCell>
      <TableCell className="text-sm">{tracker.supplier_name ?? "—"}</TableCell>
      <TableCell className="font-mono text-xs">
        {tracker.supplier_portal_reference ?? "—"}
      </TableCell>
      <TableCell>
        <Badge className={STATUS_TONE[tracker.status]}>{STATUS_LABEL[tracker.status]}</Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(tracker.updated_at).toLocaleString()}
      </TableCell>
      <TableCell>
        <Select
          value={tracker.status}
          onValueChange={(v) => updateStatus(v as Status)}
          disabled={busy}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tracker.account_number && (
          <a
            href={`/admin/customers/${tracker.account_number}/journey`}
            target="_blank"
            rel="noreferrer"
            className="block mt-1 text-[11px] underline text-muted-foreground hover:text-foreground"
          >
            View customer journey →
          </a>
        )}
      </TableCell>
    </TableRow>
  );
}

function CreateTrackerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [selectedPrId, setSelectedPrId] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierProductRef, setSupplierProductRef] = useState("");
  const [portalRef, setPortalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [readinessConfirmed, setReadinessConfirmed] = useState(false);

  const eligibleQ = useQuery({
    queryKey: ["mfo-eligible-prs"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select(
          `id, payment_request_number, amount, currency, customer_name, customer_email, account_number, user_id, contract_summary_id, paid_at,
           contract_summaries:contract_summary_id(id, cs_number, plan_name, accepted_at, pdf_url)`
        )
        .eq("status", "paid")
        .eq("webhook_verified", true)
        .not("paid_at", "is", null)
        .not("contract_summary_id", "is", null)
        .order("paid_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as EligiblePR[];
      return rows.filter(
        (r) => r.contract_summaries?.accepted_at && r.contract_summaries?.pdf_url
      );
    },
  });

  // Exclude PRs that already have a tracker
  const existingQ = useQuery({
    queryKey: ["mfo-existing-pr-ids"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_fulfilment_orders" as never)
        .select("payment_request_id");
      if (error) throw error;
      return new Set(((data as any[]) ?? []).map((r) => r.payment_request_id));
    },
  });

  const eligible = useMemo(
    () =>
      (eligibleQ.data ?? []).filter(
        (r) => !(existingQ.data?.has(r.id))
      ),
    [eligibleQ.data, existingQ.data]
  );

  const selected = eligible.find((e) => e.id === selectedPrId);

  const create = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pick a payment request");
      if (!readinessConfirmed) throw new Error("Confirm readiness checklist");
      const { data: userResp } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("manual_fulfilment_orders" as never)
        .insert({
          customer_id: selected.user_id,
          account_number: selected.account_number,
          payment_request_id: selected.id,
          contract_summary_id: selected.contract_summary_id,
          selected_product_label: selected.contract_summaries?.plan_name ?? null,
          supplier_name: supplierName || null,
          supplier_product_ref: supplierProductRef || null,
          supplier_portal_reference: portalRef || null,
          notes: notes || null,
          readiness_confirmed: true,
          created_by: userResp.user?.id ?? null,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tracker created" });
      onCreated();
      onOpenChange(false);
      setSelectedPrId("");
      setSupplierName("");
      setSupplierProductRef("");
      setPortalRef("");
      setNotes("");
      setReadinessConfirmed(false);
    },
    onError: (e: any) => {
      logError("ManualFulfilment.create", e);
      toast({
        title: "Could not create tracker",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">New manual fulfilment tracker</DialogTitle>
          <DialogDescription>
            Eligible payment requests: paid, webhook-verified, with an
            accepted Contract Summary and a stored PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Paid payment request</label>
            <Select value={selectedPrId} onValueChange={setSelectedPrId}>
              <SelectTrigger className="border-2 border-foreground">
                <SelectValue placeholder={eligibleQ.isLoading ? "Loading…" : "Choose a paid PR"} />
              </SelectTrigger>
              <SelectContent>
                {eligible.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">No eligible payment requests.</div>
                )}
                {eligible.map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>
                    {pr.payment_request_number ?? pr.id.slice(0, 8)} · {pr.customer_name} · £{(Number(pr.amount) || 0).toFixed(2)} · {pr.contract_summaries?.cs_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="border-2 border-foreground bg-muted/30 p-3 text-xs space-y-1">
              <div><strong>Customer:</strong> {selected.customer_name} ({selected.customer_email})</div>
              <div><strong>Account:</strong> {selected.account_number ?? "—"}</div>
              <div><strong>Contract Summary:</strong> {selected.contract_summaries?.cs_number}</div>
              <div><strong>Plan:</strong> {selected.contract_summaries?.plan_name}</div>
              <div><strong>Paid at:</strong> {selected.paid_at ? new Date(selected.paid_at).toLocaleString() : "—"}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Supplier</label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="e.g. ICUK, Giacom" />
            </div>
            <div>
              <label className="text-sm font-medium">Supplier product ref</label>
              <Input value={supplierProductRef} onChange={(e) => setSupplierProductRef(e.target.value)} placeholder="e.g. FTTP_500_UNLIMITED" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Supplier portal reference</label>
            <Input value={portalRef} onChange={(e) => setPortalRef(e.target.value)} placeholder="Order ID from the supplier portal" />
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <label className="flex items-start gap-2 border-2 border-foreground p-3 bg-muted/30 cursor-pointer">
            <Checkbox checked={readinessConfirmed} onCheckedChange={(v) => setReadinessConfirmed(!!v)} className="mt-0.5" />
            <span className="text-sm">
              I confirm the readiness checklist for this customer is complete
              and this tracker is being created as the final admin review
              step. No supplier API will be called by this action.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!selected || !readinessConfirmed || create.isPending}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create tracker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}