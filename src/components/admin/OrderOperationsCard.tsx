import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Order = {
  id: string;
  occta_order_number: string | null;
  lifecycle_status: string | null;
  status: string | null;
  giacom_reference: string | null;
  giacom_product_ref: string | null;
  entered_in_giacom_at: string | null;
  expected_activation_date: string | null;
  router_reference: string | null;
  internal_notes: string | null;
  service_type: string | null;
  plan_name: string | null;
  plan_price: number | null;
  preferred_start_date: string | null;
  cooling_off_ends_at: string | null;
  payment_method: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
};

const LIFECYCLE_LABEL: Record<string, string> = {
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

type ActionKey =
  | "record_giacom"
  | "processing"
  | "committed"
  | "on_hold"
  | "resume"
  | "cancellation_requested"
  | "failed"
  | "confirm_live"
  | "note";

const ACTIONS: { key: ActionKey; label: string; to: string; override?: boolean }[] = [
  { key: "record_giacom", label: "Record order in Giacom", to: "ordered" },
  { key: "processing", label: "Mark processing", to: "processing" },
  { key: "committed", label: "Mark committed", to: "committed" },
  { key: "on_hold", label: "Put on hold", to: "on_hold" },
  { key: "resume", label: "Resume processing", to: "processing" },
  { key: "cancellation_requested", label: "Start cancellation", to: "cancellation_requested" },
  { key: "failed", label: "Mark failed", to: "failed" },
  { key: "confirm_live", label: "Confirm service live", to: "__live__" },
  { key: "note", label: "Add note", to: "__note__" },
];

export function OrderOperationsCard({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openAction, setOpenAction] = useState<null | typeof ACTIONS[number]>(null);
  const [form, setForm] = useState({
    giacom_reference: "",
    giacom_product_ref: "",
    router_reference: "",
    entered_in_giacom_at: "",
    expected_activation_date: "",
    customer_note: "",
    internal_note: "",
    override: false,
    actual_activation_date: "",
    activation_reference: "",
    activation_notes: "",
    confirm: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["order-operations", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, occta_order_number, lifecycle_status, status, giacom_reference, giacom_product_ref, entered_in_giacom_at, expected_activation_date, router_reference, internal_notes, service_type, plan_name, plan_price, preferred_start_date, cooling_off_ends_at, payment_method, address_line1, address_line2, city, postcode, contract_summary_id")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Order;
    },
  });

  // Priority 1 admin guard: fetch the Contract Summary status linked to this
  // order. If it hasn't been accepted, the confirm-service-live action is
  // disabled and a blocker banner is shown.
  const contractSummaryId = (orderQuery.data as any)?.contract_summary_id ?? null;
  const csQuery = useQuery({
    queryKey: ["order-cs-status", orderId, contractSummaryId],
    enabled: !!contractSummaryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_summaries")
        .select("id, status, accepted_at")
        .eq("id", contractSummaryId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const csAccepted =
    !!csQuery.data && (csQuery.data as any).status === "accepted" && !!(csQuery.data as any).accepted_at;
  const csBlocked = !contractSummaryId || !csAccepted;

  const historyQuery = useQuery({
    queryKey: ["order-history", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id, previous_status, new_status, changed_at, source, customer_note, internal_note, giacom_reference, expected_activation_date")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const order = orderQuery.data;

  const submit = async () => {
    if (!openAction || !order) return;
    setSubmitting(true);
    try {
      // Special path: confirm-service-live uses its own edge function.
      if (openAction.key === "confirm_live") {
        const actualActivationDate = form.actual_activation_date.trim();
        const activationReference = form.activation_reference.trim();
        const giacomReference = (form.giacom_reference || order.giacom_reference || activationReference).trim();

        if (!actualActivationDate || !activationReference || !form.confirm) {
          throw new Error("Confirm the activation date, reference, and checkbox before applying.");
        }

        const payload: Record<string, unknown> = {
          order_id: order.id,
          actual_activation_date: actualActivationDate,
          activation_reference: activationReference,
          activation_notes: form.activation_notes.trim() || undefined,
          giacom_reference: giacomReference,
          customer_note: form.customer_note || undefined,
          internal_note: form.internal_note || undefined,
          confirm: form.confirm,
        };
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Your admin session has expired. Please sign in again.");

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-service-live`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(String(data?.message ?? data?.error ?? `Activation failed (${response.status})`));
        }
        if (data?.error) throw new Error(String(data.message ?? data.error));
        toast({
          title: data?.already_live ? "Already live" : "Service activated",
          description: `Next billing: ${data?.next_billing_date ?? "—"}`,
        });
        setOpenAction(null);
        setForm({
          giacom_reference: "", giacom_product_ref: "", router_reference: "",
          entered_in_giacom_at: "", expected_activation_date: "",
          customer_note: "", internal_note: "", override: false,
          actual_activation_date: "", activation_reference: "", activation_notes: "", confirm: false,
        });
        qc.invalidateQueries({ queryKey: ["order-operations", orderId] });
        qc.invalidateQueries({ queryKey: ["order-history", orderId] });
        qc.invalidateQueries({ queryKey: ["admin-customer"] });
        return;
      }

      const payload: Record<string, unknown> = {
        order_id: order.id,
        to_status: openAction.to === "__note__" ? (order.lifecycle_status ?? "order_received") : openAction.to,
      };
      if (form.giacom_reference) payload.giacom_reference = form.giacom_reference;
      if (form.giacom_product_ref) payload.giacom_product_ref = form.giacom_product_ref;
      if (form.router_reference) payload.router_reference = form.router_reference;
      if (form.entered_in_giacom_at) payload.entered_in_giacom_at = new Date(form.entered_in_giacom_at).toISOString();
      if (form.expected_activation_date) payload.expected_activation_date = form.expected_activation_date;
      if (form.customer_note) payload.customer_note = form.customer_note;
      if (form.internal_note) payload.internal_note = form.internal_note;
      if (form.override) payload.override = true;

      const { data, error } = await supabase.functions.invoke("order-lifecycle-transition", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast({ title: "Order updated" });
      setOpenAction(null);
      setForm({
        giacom_reference: "", giacom_product_ref: "", router_reference: "",
        entered_in_giacom_at: "", expected_activation_date: "",
        customer_note: "", internal_note: "", override: false,
        actual_activation_date: "", activation_reference: "", activation_notes: "", confirm: false,
      });
      qc.invalidateQueries({ queryKey: ["order-operations", orderId] });
      qc.invalidateQueries({ queryKey: ["order-history", orderId] });
      qc.invalidateQueries({ queryKey: ["admin-customer"] });
    } catch (e) {
      toast({ title: "Transition failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (orderQuery.isLoading) {
    return <Card className="border-2 border-foreground p-4 text-sm text-muted-foreground">Loading operations…</Card>;
  }
  if (!order) return null;

  const lifecycle = order.lifecycle_status ?? "order_received";
  const fmtDate = (v: string | null | undefined) => v ? format(new Date(v), "dd MMM yyyy HH:mm") : "—";
  const fmtDay = (v: string | null | undefined) => v ? format(new Date(v), "dd MMM yyyy") : "—";

  const isActive = (a: typeof ACTIONS[number]) => {
    if (a.key === "note") return true;
    if (a.key === "confirm_live") return lifecycle === "committed" && !csBlocked;
    if (a.key === "record_giacom") return lifecycle === "order_received";
    if (a.key === "resume") return lifecycle === "on_hold";
    if (a.key === "failed") return ["ordered","processing","committed"].includes(lifecycle);
    if (a.key === "processing") return ["ordered","on_hold","committed","cancellation_requested"].includes(lifecycle);
    if (a.key === "committed") return ["processing","on_hold","cancellation_requested"].includes(lifecycle);
    if (a.key === "on_hold") return ["ordered","processing","committed"].includes(lifecycle);
    if (a.key === "cancellation_requested") return ["ordered","processing","committed","on_hold"].includes(lifecycle);
    return false;
  };

  return (
    <Card className="border-2 border-foreground p-4 space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Operations</div>
          <div className="text-lg font-semibold">{order.occta_order_number ?? "(no OCCTA number)"}</div>
        </div>
        <Badge variant="outline" className="border-2 border-foreground uppercase">
          {LIFECYCLE_LABEL[lifecycle] ?? lifecycle}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <Field label="Accepted plan" value={order.plan_name} />
        <Field label="Monthly price" value={order.plan_price != null ? `£${Number(order.plan_price).toFixed(2)}` : null} />
        <Field label="Service address" value={[order.address_line1, order.address_line2, order.city, order.postcode].filter(Boolean).join(", ") || null} />
        <Field label="Preferred start date" value={fmtDay(order.preferred_start_date)} />
        <Field label="Cooling-off ends" value={fmtDate(order.cooling_off_ends_at)} />
        <Field label="Payment method" value={order.payment_method} />
        <Field label="Entered into Giacom" value={fmtDate(order.entered_in_giacom_at)} />
        <Field label="Giacom reference" value={order.giacom_reference} />
        <Field label="Giacom product ref" value={order.giacom_product_ref} />
        <Field label="Expected activation" value={fmtDay(order.expected_activation_date)} />
        <Field label="Router / tracking" value={order.router_reference} />
      </div>

      {csBlocked && (
        <div className="border-2 border-destructive bg-destructive/10 text-destructive px-3 py-2 text-sm font-semibold">
          Contract Summary not accepted — order/service cannot proceed.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant={a.key === "failed" || a.key === "cancellation_requested" ? "destructive" : "outline"}
            disabled={!isActive(a)}
            onClick={() => setOpenAction(a)}
            className="border-2 border-foreground"
          >
            {a.label}
          </Button>
        ))}
      </div>

      <div>
        <div className="text-xs uppercase text-muted-foreground mb-2">Status history</div>
        <div className="space-y-1 max-h-64 overflow-y-auto border-2 border-foreground p-2">
          {(historyQuery.data ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground">No history yet.</div>
          )}
          {(historyQuery.data ?? []).map((h: any) => (
            <div key={h.id} className="text-xs border-b border-border last:border-0 py-1">
              <div className="font-mono">
                {fmtDate(h.changed_at)} — {h.previous_status ?? "∅"} → <strong>{h.new_status}</strong>
                <span className="ml-2 opacity-70">[{h.source}]</span>
              </div>
              {h.customer_note && <div className="text-muted-foreground">Customer: {h.customer_note}</div>}
              {h.internal_note && <div className="text-muted-foreground">Internal: {h.internal_note}</div>}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!openAction} onOpenChange={(o) => !o && setOpenAction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{openAction?.label}</DialogTitle>
            <DialogDescription>
              {openAction?.to === "ordered" && "Confirm the order has been entered into Giacom."}
              {openAction?.to === "committed" && "Supplier has committed the order. An expected activation date is required."}
              {openAction?.to === "__note__" && "Add a note to the order history."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {openAction?.to === "ordered" && (
              <>
                <div>
                  <Label>Entered into Giacom at *</Label>
                  <Input type="datetime-local" value={form.entered_in_giacom_at}
                    onChange={(e) => setForm({ ...form, entered_in_giacom_at: e.target.value })} />
                </div>
                <div>
                  <Label>Giacom reference (optional — may be added later)</Label>
                  <Input value={form.giacom_reference}
                    onChange={(e) => setForm({ ...form, giacom_reference: e.target.value })} />
                </div>
                <div>
                  <Label>Giacom product ref</Label>
                  <Input value={form.giacom_product_ref}
                    onChange={(e) => setForm({ ...form, giacom_product_ref: e.target.value })} />
                </div>
                <div>
                  <Label>Router / tracking reference</Label>
                  <Input value={form.router_reference}
                    onChange={(e) => setForm({ ...form, router_reference: e.target.value })} />
                </div>
              </>
            )}
            {openAction?.to === "committed" && (
              <>
                <div>
                  <Label>Expected activation date *</Label>
                  <Input type="date" value={form.expected_activation_date}
                    onChange={(e) => setForm({ ...form, expected_activation_date: e.target.value })} />
                </div>
                <div>
                  <Label>Internal confirmation note *</Label>
                  <Textarea value={form.internal_note}
                    onChange={(e) => setForm({ ...form, internal_note: e.target.value })}
                    placeholder="Confirm the supplier has committed the order…" />
                </div>
              </>
            )}
            {openAction?.key === "confirm_live" && (
              <>
                <div className="text-xs border-2 border-foreground p-2 bg-muted/40">
                  This activates the service, starts billing on the customer's
                  preferred anchor day, and queues the activation email. No
                  supplier/DD/Worldpay action is taken.
                </div>
                <div>
                  <Label>Actual activation date *</Label>
                  <Input type="date" value={form.actual_activation_date}
                    onChange={(e) => setForm({ ...form, actual_activation_date: e.target.value })} />
                </div>
                <div>
                  <Label>Activation reference *</Label>
                  <Input value={form.activation_reference}
                    onChange={(e) => setForm({ ...form, activation_reference: e.target.value })}
                    placeholder="Supplier / Giacom activation reference" />
                </div>
                <div>
                  <Label>Giacom reference (only if not yet recorded)</Label>
                  <Input value={form.giacom_reference}
                    onChange={(e) => setForm({ ...form, giacom_reference: e.target.value })} />
                </div>
                <div>
                  <Label>Activation notes (optional)</Label>
                  <Textarea value={form.activation_notes}
                    onChange={(e) => setForm({ ...form, activation_notes: e.target.value })} />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.checked })} />
                  <span>I confirm this service is live and billing should begin.</span>
                </label>
              </>
            )}
            {openAction?.to !== "ordered" && openAction?.to !== "committed" && openAction?.key !== "confirm_live" && (
              <div>
                <Label>Giacom reference (optional)</Label>
                <Input value={form.giacom_reference}
                  onChange={(e) => setForm({ ...form, giacom_reference: e.target.value })} />
              </div>
            )}
            {openAction?.key !== "confirm_live" && (
              <>
                <div>
                  <Label>Internal note</Label>
                  <Textarea value={form.internal_note}
                    onChange={(e) => setForm({ ...form, internal_note: e.target.value })} />
                </div>
                <div>
                  <Label>Customer-visible note (optional)</Label>
                  <Textarea value={form.customer_note}
                    onChange={(e) => setForm({ ...form, customer_note: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAction(null)} disabled={submitting}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                (openAction?.key === "confirm_live" &&
                  (!form.confirm ||
                    !form.actual_activation_date ||
                    !form.activation_reference.trim()))
              }
            >
              {submitting ? "Working…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value ?? "—"}</div>
    </div>
  );
}