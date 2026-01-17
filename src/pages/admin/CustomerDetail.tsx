import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Copy, ArrowLeft, Pencil, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { AddServiceDialog } from "@/components/admin/AddServiceDialog";
import { CustomerEditDialog } from "@/components/admin/CustomerEditDialog";
import { logAudit } from "@/lib/audit";
import { normalizeAccountNumber, isAccountNumberValid } from "@/lib/account";

export const AdminCustomerDetail = () => {
  const { accountNumber: rawAccountNumber } = useParams<{ accountNumber: string }>();
  const navigate = useNavigate();
  const accountNumber = rawAccountNumber ? normalizeAccountNumber(rawAccountNumber) : null;
  const { toast } = useToast();
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);

  const { data, refetch, isLoading, isError } = useQuery({
    queryKey: ["admin-customer", accountNumber],
    enabled: !!accountNumber && isAccountNumberValid(accountNumber),
    queryFn: async () => {
      if (!accountNumber) return null;
      
      // First find the profile by account number
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("account_number", accountNumber)
        .maybeSingle();
      
      if (profileError || !profileData) {
        throw new Error("Customer not found");
      }
      
      const userId = profileData.id;
      
      const [orders, tickets, files, services, invoices] = await Promise.all([
        supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase
          .from("support_tickets")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("user_files").select("*").eq("user_id", userId),
        supabase.from("services").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      return {
        profile: profileData,
        orders: orders.data ?? [],
        tickets: tickets.data ?? [],
        files: files.data ?? [],
        services: services.data ?? [],
        invoices: invoices.data ?? [],
      };
    },
  });

  const overview = useMemo(() => data?.profile, [data?.profile]);
  const services = useMemo(() => data?.services ?? [], [data?.services]);
  const invoices = useMemo(() => data?.invoices ?? [], [data?.invoices]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/customers")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Button>
        <Card className="border-2 border-foreground p-8 text-center">
          <p className="text-muted-foreground">Customer not found for account {accountNumber || rawAccountNumber}.</p>
        </Card>
      </div>
    );
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
    const previousStatus = services.find(s => s.id === serviceId)?.status;
    
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

    // Log audit action
    const actionMap: Record<string, string> = {
      suspended: "suspend",
      active: "resume",
      cancelled: "cancel",
    };
    const action = actionMap[status] || "update";
    await logAudit({
      action: action as any,
      entity: "service",
      entityId: serviceId,
      metadata: { 
        previousStatus, 
        newStatus: status,
        accountNumber: overview.account_number,
      },
    });

    toast({ title: "Service updated" });
    setUpdatingServiceId(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/admin/customers")} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Button>
      <div className="flex items-start justify-between">
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
        <CustomerEditDialog
          customer={overview}
          onSaved={refetch}
          trigger={
            <Button variant="outline" className="border-2 border-foreground">
              <Pencil className="w-4 h-4 mr-2" />
              Edit Customer
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
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
            {overview.admin_notes && (
              <Card className="border-2 border-warning/50 bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <StickyNote className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs uppercase text-muted-foreground font-display mb-1">Internal Notes</div>
                    <p className="text-sm whitespace-pre-wrap">{overview.admin_notes}</p>
                  </div>
                </div>
              </Card>
            )}
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

        <TabsContent value="billing" className="mt-4 space-y-4">
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-4">Invoices</h3>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-4 border-foreground">
                    <TableHead className="font-display uppercase">Invoice #</TableHead>
                    <TableHead className="font-display uppercase">Status</TableHead>
                    <TableHead className="font-display uppercase">Issue Date</TableHead>
                    <TableHead className="font-display uppercase">Due Date</TableHead>
                    <TableHead className="font-display uppercase text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-b-2 border-foreground/20">
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-2 border-foreground capitalize">
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell className="text-right">£{Number(invoice.total).toFixed(2)}</TableCell>
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
              <div className="text-xs text-muted-foreground mt-1">Created: {formatDate(order.created_at)}</div>
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
