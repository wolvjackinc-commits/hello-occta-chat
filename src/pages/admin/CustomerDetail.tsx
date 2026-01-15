import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export const AdminCustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [note, setNote] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["admin-customer", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const [profile, orders, tickets, services, invoices, notes, files, activity, mandates, attempts] =
        await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("orders").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase
          .from("support_tickets")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("services").select("*").eq("user_id", id),
        supabase.from("invoices").select("*").eq("user_id", id).order("issue_date", { ascending: false }),
        supabase.from("customer_notes").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase.from("user_files").select("*").eq("user_id", id),
        supabase.from("audit_log").select("*").eq("record_id", id).order("created_at", { ascending: false }),
        supabase.from("dd_mandates").select("*").eq("user_id", id),
        supabase.from("payment_attempts").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      ]);

      return {
        profile: profile.data,
        orders: orders.data ?? [],
        tickets: tickets.data ?? [],
        services: services.data ?? [],
        invoices: invoices.data ?? [],
        notes: notes.data ?? [],
        files: files.data ?? [],
        activity: activity.data ?? [],
        mandates: mandates.data ?? [],
        attempts: attempts.data ?? [],
      };
    },
  });

  const overview = useMemo(() => data?.profile, [data?.profile]);
  const outstandingBalance = useMemo(() => {
    return (data?.invoices ?? []).reduce((sum, invoice) => {
      if (invoice.status === "paid") return sum;
      const total = (invoice.totals as { total?: number })?.total ?? 0;
      return sum + Number(total);
    }, 0);
  }, [data?.invoices]);

  const handleAddNote = async () => {
    if (!id || !note.trim()) return;
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_notes").insert({
      user_id: id,
      note: note.trim(),
      visibility: "internal",
      created_by: authData?.user?.id,
    });
    if (error) {
      toast({ title: "Failed to add note", variant: "destructive" });
      return;
    }
    await supabase.from("audit_log").insert({
      action: "ADD_CUSTOMER_NOTE",
      table_name: "customer_notes",
      record_id: id,
      before: null,
      after: { note: note.trim(), visibility: "internal" },
    });
    setNote("");
    toast({ title: "Note added" });
    refetch();
  };

  if (!overview) {
    return <p className="text-muted-foreground">Loading customer...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">{overview.full_name || "Customer"}</h1>
        <p className="text-muted-foreground">{overview.email}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="direct-debit">Direct Debit</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="border-2 border-foreground p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Account number</div>
                <div className="text-sm font-medium">{overview.account_number || "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Phone</div>
                <div className="text-sm font-medium">{overview.phone || "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Address</div>
                <div className="text-sm font-medium">
                  {overview.address_line1 || "—"} {overview.city} {overview.postcode}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Outstanding balance</div>
                <div className="text-sm font-medium">£{outstandingBalance.toFixed(2)}</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4 space-y-3">
          {data?.services.map((service) => (
            <Card key={service.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{service.service_type}</div>
              <div className="text-sm text-muted-foreground">Status: {service.status}</div>
              <div className="text-xs text-muted-foreground">Activation: {service.activation_date || "—"}</div>
              {service.suspension_reason && (
                <div className="text-xs text-muted-foreground">Suspended: {service.suspension_reason}</div>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-3">
          {data?.orders.map((order) => (
            <Card key={order.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{order.service_type} · {order.plan_name}</div>
              <div className="text-sm text-muted-foreground">Status: {order.status}</div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-3">
          {data?.invoices.map((invoice) => (
            <Card key={invoice.id} className="border-2 border-foreground p-4">
              <div className="font-medium">Invoice {invoice.invoice_number}</div>
              <div className="text-sm text-muted-foreground">Status: {invoice.status}</div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="direct-debit" className="mt-4 space-y-4">
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg">Mandates</h3>
            <div className="space-y-2">
              {data?.mandates.map((mandate) => (
                <div key={mandate.id} className="rounded-md border border-border p-3">
                  <div className="text-sm font-medium">{mandate.status}</div>
                  <div className="text-xs text-muted-foreground">Ref: {mandate.mandate_reference}</div>
                </div>
              ))}
              {!data?.mandates.length && (
                <p className="text-sm text-muted-foreground">No mandates recorded.</p>
              )}
            </div>
          </Card>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg">Payment attempts</h3>
            <div className="space-y-2">
              {data?.attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-md border border-border p-3">
                  <div className="text-sm font-medium">{attempt.status}</div>
                  <div className="text-xs text-muted-foreground">£{attempt.amount} · {attempt.reason || "—"}</div>
                </div>
              ))}
              {!data?.attempts.length && (
                <p className="text-sm text-muted-foreground">No payment attempts logged.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-3">
          {data?.tickets.map((ticket) => (
            <Card key={ticket.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{ticket.subject}</div>
              <div className="text-sm text-muted-foreground">Status: {ticket.status}</div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add internal note"
          />
          <Button onClick={handleAddNote}>Add note</Button>
          <div className="space-y-3">
            {data?.notes.map((entry) => (
              <Card key={entry.id} className="border-2 border-foreground p-4">
                <div className="text-sm">{entry.note}</div>
                <div className="text-xs text-muted-foreground">{entry.visibility}</div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          {data?.files.map((file) => (
            <Card key={file.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{file.file_name}</div>
              <div className="text-xs text-muted-foreground">{file.file_type}</div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-3">
          {data?.activity.map((entry) => (
            <Card key={entry.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{entry.action} on {entry.table_name}</div>
              <div className="text-xs text-muted-foreground">{entry.created_at}</div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
