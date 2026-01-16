import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Json } from "@/integrations/supabase/types";
import { Copy } from "lucide-react";
import { format } from "date-fns";
import { AddServiceDialog } from "@/components/admin/AddServiceDialog";

export const AdminCustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["admin-customer", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const [profile, orders, tickets, files, services] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase
          .from("support_tickets")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("user_files").select("*").eq("user_id", id),
        supabase.from("services").select("*").eq("user_id", id).order("updated_at", { ascending: false }),
      ]);

      return {
        profile: profile.data,
        orders: orders.data ?? [],
        tickets: tickets.data ?? [],
        files: files.data ?? [],
        services: services.data ?? [],
      };
    },
  });

  const overview = useMemo(() => data?.profile, [data?.profile]);
  const services = useMemo(() => data?.services ?? [], [data?.services]);

  if (!overview) {
    return <p className="text-muted-foreground">Loading customer...</p>;
  }

  const handleCopy = async (value?: string | null, label = "Value") => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, "dd MMM yyyy");
  };

  const getServiceIdentifier = (serviceType: string, identifiers: Json | null) => {
    if (!identifiers || typeof identifiers !== "object" || Array.isArray(identifiers)) return "—";
    const record = identifiers as Record<string, unknown>;
    if (serviceType === "landline") return record.number ? String(record.number) : "—";
    if (serviceType === "sim") return record.msisdn ? String(record.msisdn) : "—";
    if (serviceType === "broadband") return record.username ? String(record.username) : "—";
    return "—";
  };

  const updateServiceStatus = async (serviceId: string, status: string) => {
    setUpdatingServiceId(serviceId);
    const { error } = await supabase
      .from("services")
      .update({
        status,
        suspension_reason: status === "suspended" ? "Suspended by admin" : null,
      })
      .eq("id", serviceId);

    if (error) {
      toast({ title: "Failed to update service", description: error.message, variant: "destructive" });
      setUpdatingServiceId(null);
      return;
    }

    toast({ title: "Service updated" });
    setUpdatingServiceId(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-display">{overview.account_number || "Account —"}</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(overview.account_number, "Account number")}
            disabled={!overview.account_number}
            aria-label="Copy account number"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-muted-foreground">{overview.full_name || "Customer"}</p>
        <p className="text-muted-foreground">{overview.email}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <AddServiceDialog
                trigger={<Button className="border-2 border-foreground">Add service</Button>}
                defaultAccountNumber={overview.account_number}
                readOnlyAccountNumber
                defaultCustomerId={overview.id}
                onSaved={refetch}
              />
            </div>
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
              </div>
            </Card>
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced</AccordionTrigger>
                <AccordionContent>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">User ID</div>
                      <div className="text-sm font-medium">{overview.id}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(overview.id, "User ID")}
                      aria-label="Copy user ID"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <AddServiceDialog
              trigger={<Button className="border-2 border-foreground">Add service</Button>}
              defaultAccountNumber={overview.account_number}
              readOnlyAccountNumber
              defaultCustomerId={overview.id}
              onSaved={refetch}
            />
          </div>
          <Card className="border-2 border-foreground p-4">
            {services.length === 0 ? (
              <div className="text-sm text-muted-foreground">No services found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-4 border-foreground">
                    <TableHead className="font-display uppercase">Type</TableHead>
                    <TableHead className="font-display uppercase">Status</TableHead>
                    <TableHead className="font-display uppercase">Identifier</TableHead>
                    <TableHead className="font-display uppercase">Supplier ref</TableHead>
                    <TableHead className="font-display uppercase">Activation date</TableHead>
                    <TableHead className="font-display uppercase">Updated</TableHead>
                    <TableHead className="font-display uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id} className="border-b-2 border-foreground/20">
                      <TableCell className="capitalize">{service.service_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-2 border-foreground capitalize">
                          {service.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{getServiceIdentifier(service.service_type, service.identifiers)}</TableCell>
                      <TableCell>{service.supplier_reference || "—"}</TableCell>
                      <TableCell>{formatDate(service.activation_date)}</TableCell>
                      <TableCell>{formatDate(service.updated_at)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingServiceId === service.id}
                          onClick={() => updateServiceStatus(service.id, "suspended")}
                          className="border-2 border-foreground"
                        >
                          Suspend
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingServiceId === service.id}
                          onClick={() => updateServiceStatus(service.id, "active")}
                          className="border-2 border-foreground"
                        >
                          Reactivate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingServiceId === service.id}
                          onClick={() => updateServiceStatus(service.id, "cancelled")}
                          className="border-2 border-foreground"
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-3">
          {data?.orders.map((order) => (
            <Card key={order.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{order.service_type} · {order.plan_name}</div>
              <div className="text-sm text-muted-foreground">Status: {order.status}</div>
            </Card>
          ))}
          {(!data?.orders || data.orders.length === 0) && (
            <p className="text-muted-foreground">No orders found.</p>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-3">
          {data?.tickets.map((ticket) => (
            <Card key={ticket.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{ticket.subject}</div>
              <div className="text-sm text-muted-foreground">Status: {ticket.status}</div>
            </Card>
          ))}
          {(!data?.tickets || data.tickets.length === 0) && (
            <p className="text-muted-foreground">No tickets found.</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          {data?.files.map((file) => (
            <Card key={file.id} className="border-2 border-foreground p-4">
              <div className="font-medium">{file.file_name}</div>
              <div className="text-xs text-muted-foreground">{file.file_type}</div>
            </Card>
          ))}
          {(!data?.files || data.files.length === 0) && (
            <p className="text-muted-foreground">No documents found.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
