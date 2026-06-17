import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, RefreshCw, ShieldAlert, Plus, ExternalLink, FileText, Truck,
} from "lucide-react";
import { logError } from "@/lib/logger";

/**
 * Manual Giacom Tracking (Phase 6) — operational view of canonical OCCTA orders.
 *
 * - Source of truth: `orders.lifecycle_status`.
 * - Tracker rows are 1-to-1 with canonical orders (`manual_fulfilment_orders.order_id`).
 * - Status changes ALWAYS go through `order-lifecycle-transition`.
 * - Activation ALWAYS goes through `confirm-service-live`.
 * - This screen never updates `services`, never calls supplier APIs,
 *   never creates invoices / DD collections / Worldpay charges.
 */

type LifecycleStatus =
  | "order_received" | "ordered" | "processing" | "committed"
  | "on_hold" | "cancellation_requested" | "cancelled" | "failed" | "live";

const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  order_received: "Order received",
  ordered: "Ordered",
  processing: "Processing",
  committed: "Committed",
  on_hold: "On hold",
  cancellation_requested: "Cancellation requested",
  cancelled: "Cancelled",
  failed: "Failed",
  live: "Live",
};

const LIFECYCLE_TONE: Record<LifecycleStatus, string> = {
  order_received: "bg-muted text-foreground",
  ordered: "bg-accent/20 text-foreground",
  processing: "bg-primary/20 text-foreground",
  committed: "bg-primary/30 text-foreground",
  on_hold: "bg-warning/20 text-foreground",
  cancellation_requested: "bg-warning/30 text-foreground",
  cancelled: "bg-destructive/20 text-foreground",
  failed: "bg-destructive/30 text-foreground",
  live: "bg-success/20 text-foreground",
};

type EligibleRow = {
  order_id: string;
  occta_order_number: string;
  account_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  plan_name: string;
  plan_price: number | null;
  service_type: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string;
  preferred_start_date: string | null;
  cooling_off_ends_at: string | null;
  lifecycle_status: LifecycleStatus | null;
  giacom_reference: string | null;
  giacom_product_ref: string | null;
  entered_in_giacom_at: string | null;
  expected_activation_date: string | null;
  actual_activation_date: string | null;
  cs_number: string | null;
  estimated_download_speed: number | null;
  estimated_upload_speed: number | null;
  payment_method: string | null;
  tracker_id: string | null;
  tracker_status: string | null;
  tracker_notes: string | null;
  contract_summary_id: string | null;
};

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All eligible" },
  { value: "no_tracker", label: "No tracker yet" },
  { value: "order_received", label: "Order received" },
  { value: "ordered", label: "Ordered" },
  { value: "processing", label: "Processing" },
  { value: "committed", label: "Committed (ready for activation)" },
  { value: "on_hold", label: "On hold" },
  { value: "cancellation_requested", label: "Cancellation requested" },
];

export default function ManualFulfilment() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [actionRow, setActionRow] = useState<EligibleRow | null>(null);

  const rowsQ = useQuery({
    queryKey: ["mgt-eligible-orders", filter],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("manual_fulfilment_eligible_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as EligibleRow[];
      if (filter === "all") return rows;
      if (filter === "no_tracker") return rows.filter((r) => !r.tracker_id);
      return rows.filter((r) => (r.lifecycle_status ?? "order_received") === filter);
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["mgt-eligible-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-customer"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight">
            Manual Giacom Tracking
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl mt-1">
            Operational view of canonical OCCTA orders ready to be placed in
            the Giacom supplier portal. The order&apos;s lifecycle is the
            single source of truth. Status changes here call the same
            server-side transition engine used everywhere else in admin —
            this screen never updates services, sends customer emails,
            collects payments, or talks to a supplier API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[260px] border-2 border-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => rowsQ.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-2 border-foreground">
        <div className="border-b-2 border-foreground bg-warning/10 px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Manual fulfilment only.</strong> Actions here record what
            staff have done in Giacom — they do not submit anything to
            Giacom, do not activate services, and do not charge customers.
            Use the Giacom portal for the actual order.
          </div>
        </div>

        {rowsQ.isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rowsQ.isError ? (
          <div className="p-6 text-sm text-destructive">Failed to load orders.</div>
        ) : (rowsQ.data?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
            <div className="font-display uppercase text-base text-foreground">
              No eligible orders
            </div>
            <div>
              Orders appear here once: customer + account number + accepted
              Contract Summary (with PDF) + payment method + preferred start
              date + cooling-off period elapsed, and the order is not yet live
              or cancelled.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OCCTA order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Plan / speed / price</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Start / cooling-off</TableHead>
                  <TableHead>Giacom ref</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead className="w-[160px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsQ.data!.map((r) => (
                  <RowView key={r.order_id} row={r} onAct={setActionRow} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {actionRow && (
        <RowActionDialog
          row={actionRow}
          onClose={() => setActionRow(null)}
          onDone={() => { setActionRow(null); refresh(); toast({ title: "Order updated" }); }}
        />
      )}
    </div>
  );
}

function RowView({
  row, onAct,
}: { row: EligibleRow; onAct: (r: EligibleRow) => void }) {
  const ls = (row.lifecycle_status ?? "order_received") as LifecycleStatus;
  const speed =
    row.estimated_download_speed
      ? `${row.estimated_download_speed}/${row.estimated_upload_speed ?? "?"} Mbps`
      : "—";
  const price = row.plan_price != null ? `£${Number(row.plan_price).toFixed(2)}` : "—";
  const startDate = row.preferred_start_date ?? "—";
  const coolingEnd = row.cooling_off_ends_at
    ? new Date(row.cooling_off_ends_at).toLocaleDateString()
    : "—";
  const accountHref = row.account_number ? `/admin/customers/${row.account_number}` : null;

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        <div className="font-semibold">{row.occta_order_number}</div>
        <div className="text-muted-foreground">{row.cs_number ?? "—"}</div>
      </TableCell>
      <TableCell className="text-xs">
        <div className="font-medium">{row.customer_name ?? "—"}</div>
        {accountHref ? (
          <Link to={accountHref} className="underline text-muted-foreground hover:text-foreground">
            {row.account_number}
          </Link>
        ) : (
          <span className="text-destructive">Account reconciliation required</span>
        )}
      </TableCell>
      <TableCell className="text-xs">
        <div className="font-medium">{row.plan_name}</div>
        <div className="text-muted-foreground">{speed} · {price}</div>
        <div className="text-muted-foreground capitalize">{row.payment_method ?? "—"}</div>
      </TableCell>
      <TableCell className="text-xs">
        <div>{[row.address_line1, row.address_line2].filter(Boolean).join(", ") || "—"}</div>
        <div className="text-muted-foreground">{[row.city, row.postcode].filter(Boolean).join(" ")}</div>
      </TableCell>
      <TableCell className="text-xs">
        <div>Start: {startDate}</div>
        <div className="text-muted-foreground">Cooling-off ends: {coolingEnd}</div>
      </TableCell>
      <TableCell className="text-xs font-mono">
        <div>{row.giacom_reference ?? "—"}</div>
        <div className="text-muted-foreground">
          {row.entered_in_giacom_at
            ? `Entered ${new Date(row.entered_in_giacom_at).toLocaleDateString()}`
            : "Not entered"}
        </div>
        {row.expected_activation_date && (
          <div className="text-muted-foreground">Expected: {row.expected_activation_date}</div>
        )}
      </TableCell>
      <TableCell>
        <Badge className={LIFECYCLE_TONE[ls]}>{LIFECYCLE_LABEL[ls]}</Badge>
        {row.actual_activation_date && (
          <div className="text-[10px] text-muted-foreground mt-1">
            Live since {row.actual_activation_date}
          </div>
        )}
      </TableCell>
      <TableCell className="space-y-1">
        <Button size="sm" variant="outline" className="w-full" onClick={() => onAct(row)}>
          Actions
        </Button>
        {accountHref && (
          <Button asChild size="sm" variant="ghost" className="w-full h-7 text-[11px]">
            <Link to={accountHref}>
              <ExternalLink className="mr-1 h-3 w-3" /> Customer 360
            </Link>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Action dialog — every status change goes through order-lifecycle-transition  */
/*  except for going live, which goes through confirm-service-live.           */
/* -------------------------------------------------------------------------- */

type ActionKind =
  | "create_tracker"
  | "record_in_giacom"   // → ordered
  | "update_giacom_ref"  // operational only
  | "mark_processing"
  | "mark_committed"
  | "put_on_hold"
  | "resume"
  | "start_cancellation"
  | "add_note"
  | "confirm_service_live";

function RowActionDialog({
  row, onClose, onDone,
}: { row: EligibleRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const ls = (row.lifecycle_status ?? "order_received") as LifecycleStatus;

  const available = useMemo<ActionKind[]>(() => {
    const out: ActionKind[] = [];
    if (!row.tracker_id) out.push("create_tracker");
    if (ls === "order_received") out.push("record_in_giacom");
    if (["ordered", "processing", "committed", "on_hold"].includes(ls)) out.push("update_giacom_ref");
    if (ls === "ordered") out.push("mark_processing");
    if (["ordered", "processing", "on_hold"].includes(ls)) out.push("mark_committed");
    if (["ordered", "processing", "committed"].includes(ls)) out.push("put_on_hold");
    if (ls === "on_hold") out.push("resume");
    if (["ordered", "processing", "committed", "on_hold"].includes(ls)) out.push("start_cancellation");
    out.push("add_note");
    if (ls === "committed") out.push("confirm_service_live");
    return out;
  }, [ls, row.tracker_id]);

  const [kind, setKind] = useState<ActionKind>(available[0]);
  const [giacomRef, setGiacomRef] = useState(row.giacom_reference ?? "");
  const [productRef, setProductRef] = useState(row.giacom_product_ref ?? "");
  const [routerRef, setRouterRef] = useState("");
  const [enteredAt, setEnteredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [expectedDate, setExpectedDate] = useState(row.expected_activation_date ?? "");
  const [internalNote, setInternalNote] = useState("");
  const [activationDate, setActivationDate] = useState(row.expected_activation_date ?? new Date().toISOString().slice(0, 10));
  const [activationRef, setActivationRef] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      if (kind === "create_tracker") {
        const { data, error } = await supabase.functions.invoke("manual-fulfilment-create-tracker", {
          body: { order_id: row.order_id, notes: internalNote || null },
        });
        if (error) throw error;
        toast({ title: (data as any)?.already_exists ? "Tracker already existed" : "Tracker created" });
      } else if (kind === "confirm_service_live") {
        if (!confirm)        throw new Error("Tick the confirmation box.");
        if (!activationDate) throw new Error("Activation date is required.");
        if (!activationRef)  throw new Error("Activation reference is required.");
        const { data, error } = await supabase.functions.invoke("confirm-service-live", {
          body: {
            order_id: row.order_id,
            actual_activation_date: activationDate,
            activation_reference: activationRef,
            giacom_reference: giacomRef || row.giacom_reference || undefined,
            internal_note: internalNote || undefined,
            confirm: true,
          },
        });
        if (error) throw error;
        toast({ title: (data as any)?.already_live ? "Service was already live" : "Service is live" });
      } else {
        // Lifecycle transition path
        const map: Record<string, { to: string; extras?: Record<string, unknown> }> = {
          record_in_giacom:   { to: "ordered",                extras: { entered_in_giacom_at: new Date(enteredAt).toISOString() } },
          update_giacom_ref:  { to: ls,                       extras: {} },
          mark_processing:    { to: "processing" },
          mark_committed:     { to: "committed",              extras: { expected_activation_date: expectedDate || undefined } },
          put_on_hold:        { to: "on_hold" },
          resume:             { to: "processing" },
          start_cancellation: { to: "cancellation_requested" },
          add_note:           { to: ls },
        };
        const m = map[kind];
        if (!m) throw new Error("Unknown action");
        if (kind === "mark_committed" && !expectedDate) {
          throw new Error("Expected activation date is required to mark committed.");
        }
        if ((kind === "mark_committed" || kind === "start_cancellation") && !internalNote) {
          throw new Error("Internal note is required for this transition.");
        }
        const { error } = await supabase.functions.invoke("order-lifecycle-transition", {
          body: {
            order_id: row.order_id,
            to_status: m.to,
            internal_note: internalNote || undefined,
            giacom_reference: giacomRef || undefined,
            giacom_product_ref: productRef || undefined,
            router_reference: routerRef || undefined,
            source: "manual_giacom_tracking",
            ...(m.extras ?? {}),
          },
        });
        if (error) throw error;
      }
      onDone();
    } catch (e: any) {
      logError("ManualFulfilment.action", e);
      toast({
        title: "Action failed",
        description: e?.context?.error ?? e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display uppercase flex items-center gap-2">
            <Truck className="h-5 w-5" /> {row.occta_order_number}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {row.customer_name} · {row.account_number ?? "no account"} · {row.plan_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="text-sm font-medium">Action</label>
            <Select value={kind} onValueChange={(v) => setKind(v as ActionKind)}>
              <SelectTrigger className="border-2 border-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "record_in_giacom" && (
            <div className="space-y-3 border-2 border-foreground p-3 bg-muted/20">
              <div className="text-xs text-muted-foreground">
                This moves the order to <strong>Ordered</strong>. The Giacom
                reference can be added now or later.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldDateTime label="Entered into Giacom at" value={enteredAt} onChange={setEnteredAt} />
                <Field label="Giacom reference (optional)" value={giacomRef} onChange={setGiacomRef} />
                <Field label="Giacom product ref (optional)" value={productRef} onChange={setProductRef} />
                <Field label="Router/tracking ref (optional)" value={routerRef} onChange={setRouterRef} />
              </div>
            </div>
          )}

          {kind === "update_giacom_ref" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Giacom reference" value={giacomRef} onChange={setGiacomRef} />
              <Field label="Giacom product ref" value={productRef} onChange={setProductRef} />
              <Field label="Router/tracking ref" value={routerRef} onChange={setRouterRef} />
            </div>
          )}

          {kind === "mark_committed" && (
            <div className="space-y-3 border-2 border-foreground p-3 bg-muted/20">
              <Field
                type="date"
                label="Expected activation date (required)"
                value={expectedDate}
                onChange={setExpectedDate}
              />
              <div className="text-xs text-muted-foreground">
                An internal note describing the supplier commitment is required.
              </div>
            </div>
          )}

          {kind === "confirm_service_live" && (
            <div className="space-y-3 border-2 border-destructive p-3 bg-destructive/5">
              <div className="text-xs">
                This is the single production action that turns the canonical
                order into a live service and starts the billing lifecycle.
              </div>
              <Field
                type="date"
                label="Actual activation date (required)"
                value={activationDate}
                onChange={setActivationDate}
              />
              <Field
                label="Activation reference (required)"
                value={activationRef}
                onChange={setActivationRef}
              />
              <Field
                label="Giacom reference (required if not already on file)"
                value={giacomRef}
                onChange={setGiacomRef}
              />
              <label className="flex items-start gap-2 cursor-pointer text-xs">
                <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} className="mt-0.5" />
                <span>
                  I confirm the customer&apos;s service is live with Giacom and
                  understand this will create the service, activation-email
                  outbox row and first-billing job atomically.
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Internal note</label>
            <Textarea
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={3}
              placeholder="Optional unless required by the chosen action."
            />
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> Contract Summary {row.cs_number ?? "—"} ·
            stored PDF on file.
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3 mt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {kind === "confirm_service_live" ? "Confirm service live" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_LABEL: Record<ActionKind, string> = {
  create_tracker:        "Create tracker",
  record_in_giacom:      "Record order entered into Giacom",
  update_giacom_ref:     "Add / update Giacom reference",
  mark_processing:       "Mark processing",
  mark_committed:        "Mark committed",
  put_on_hold:           "Put on hold",
  resume:                "Resume",
  start_cancellation:    "Start cancellation",
  add_note:              "Add internal note",
  confirm_service_live:  "Confirm service live",
};

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldDateTime(props: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field {...props} type="datetime-local" />;
}