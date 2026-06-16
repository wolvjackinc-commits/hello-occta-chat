import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
import { Copy, ArrowLeft, Pencil, StickyNote, Route as RouteIcon, AlertTriangle, ExternalLink, Send, Lock as LockIcon } from "lucide-react";
import { format } from "date-fns";
import { AddServiceDialog } from "@/components/admin/AddServiceDialog";
import { CustomerEditDialog } from "@/components/admin/CustomerEditDialog";
import { CustomerDDSection } from "@/components/admin/CustomerDDSection";
import { CustomerCommunicationsTimeline } from "@/components/admin/CustomerCommunicationsTimeline";
import { CustomerBillingSettings } from "@/components/admin/CustomerBillingSettings";
import { JourneyInternalNotes } from "@/components/admin/JourneyInternalNotes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { logAudit } from "@/lib/audit";
import { normalizeAccountNumber, isAccountNumberValid } from "@/lib/account";
import { Download, FileText, Lock, CheckCircle2, Mail } from "lucide-react";

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

      const { data: contractSummaries } = await supabase
        .from("contract_summaries")
        .select("id, cs_number, status, version, quote_id, plan_name, monthly_price_incl_vat, emailed_at, accepted_at, pdf_storage_key, pdf_sha256, created_at, updated_at")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      const { data: paymentRequests } = await supabase
        .from("payment_requests")
        .select("id, payment_request_number, status, amount, currency, paid_at, failed_at, last_opened_at, created_at, webhook_verified, contract_summary_id, provider_payment_id, customer_email")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const prIds = (paymentRequests ?? []).map((r: any) => r.id);
      const csIds = (contractSummaries ?? []).map((c: any) => c.id);
      const { data: allComms } = await (supabase as any)
        .from("communications_log")
        .select("id, payment_request_id, invoice_id, user_id, template_name, recipient_email, status, sent_at, error_message, created_at")
        .or(`user_id.eq.${userId}${prIds.length ? `,payment_request_id.in.(${prIds.join(",")})` : ""}`)
        .order("created_at", { ascending: false })
        .limit(200);
      const prComms = (allComms ?? []).filter((c: any) => c.payment_request_id);

      // Quote requests + final quotes + customer_proceeded events
      const [{ data: quoteRequests }, { data: quotes }] = await Promise.all([
        (supabase as any).from("quote_requests")
          .select("id, reference, status, service_interest, customer_type, postcode, created_at, final_quote_id")
          .eq("customer_id", userId).order("created_at", { ascending: false }),
        (supabase as any).from("quotes")
          .select("id, quote_number, status, plan_name, monthly_gross, customer_intent_proceeded_at, quote_request_id, created_at, public_token_hash")
          .eq("customer_id", userId).order("created_at", { ascending: false }),
      ]);

      const [{ data: mfos }, { data: readiness }, { data: tasks }] = await Promise.all([
        prIds.length
          ? (supabase as any).from("manual_fulfilment_orders")
              .select("id, status, payment_request_id, contract_summary_id, supplier_name, supplier_product_ref, supplier_portal_reference, notes, created_at, updated_at, activated_at, cancelled_at")
              .in("payment_request_id", prIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        prIds.length
          ? (supabase as any).from("provisioning_readiness")
              .select("id, payment_request_id, contract_summary_id, installation_confirmed, router_confirmed, internal_notes_reviewed, admin_review_complete, updated_at")
              .in("payment_request_id", prIds)
          : Promise.resolve({ data: [] as any[] }),
        (supabase as any).from("admin_tasks")
          .select("id, task_number, title, status, priority, due_date, created_at, updated_at, related_payment_request_id, related_contract_summary_id, related_quote_id")
          .eq("related_customer_id", userId).order("created_at", { ascending: false }).limit(100),
      ]);

      return {
        profile: profileData,
        orders: orders.data ?? [],
        tickets: tickets.data ?? [],
        files: files.data ?? [],
        services: services.data ?? [],
        invoices: invoices.data ?? [],
        contractSummaries: contractSummaries ?? [],
        paymentRequests: paymentRequests ?? [],
        prComms: prComms ?? [],
        allComms: allComms ?? [],
        quoteRequests: quoteRequests ?? [],
        quotes: quotes ?? [],
        mfos: mfos ?? [],
        readiness: readiness ?? [],
        tasks: tasks ?? [],
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-2 border-foreground"
            onClick={() => navigate(`/admin/customers/${overview.account_number}/journey`)}
            disabled={!overview.account_number}
          >
            <RouteIcon className="w-4 h-4 mr-2" />
            Journey
          </Button>
          <Button
            variant="outline"
            className="border-2 border-foreground"
            onClick={() => navigate(`/admin/tasks?account=${overview.account_number}`)}
            disabled={!overview.account_number}
          >
            Tasks
          </Button>
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
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <AddServiceDialog
                trigger={<Button className="border-2 border-foreground">Add service</Button>}
                defaultCustomer={{
                  id: overview.id,
                  full_name: overview.full_name,
                  email: overview.email,
                  account_number: overview.account_number,
                  phone: overview.phone,
                  date_of_birth: overview.date_of_birth,
                  latest_postcode: overview.postcode,
                  latest_postcode_normalized: null,
                  created_at: overview.created_at,
                }}
                readOnlyCustomer
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

            {/* Direct Debit Section */}
            <CustomerDDSection userId={overview.id} accountNumber={overview.account_number} />

            {/* Communications Timeline */}
            <CustomerCommunicationsTimeline userId={overview.id} />

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
              defaultCustomer={{
                id: overview.id,
                full_name: overview.full_name,
                email: overview.email,
                account_number: overview.account_number,
                phone: overview.phone,
                date_of_birth: overview.date_of_birth,
                latest_postcode: overview.postcode,
                latest_postcode_normalized: null,
                created_at: overview.created_at,
              }}
              readOnlyCustomer
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
          {/* Billing Settings */}
          <CustomerBillingSettings 
            userId={overview.id} 
            accountNumber={overview.account_number} 
            onUpdate={refetch}
          />

          {/* Invoices */}
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

        <TabsContent value="finance" className="mt-4 space-y-3">
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Payment requests</h3>
            {(!data?.paymentRequests || data.paymentRequests.length === 0) ? (
              <p className="text-sm text-muted-foreground">No payment requests yet.</p>
            ) : (
              <div className="space-y-3">
                {data.paymentRequests.map((pr: any) => (
                  <AdminPrRow key={pr.id} pr={pr} comms={(data.prComms || []).filter((c: any) => c.payment_request_id === pr.id)} />
                ))}
              </div>
            )}
          </Card>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Direct Debit</h3>
            <CustomerDDSection userId={overview.id} accountNumber={overview.account_number} />
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
          <Card className="border-2 border-foreground p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5" />
              <h3 className="font-display uppercase text-base">Contract Summaries</h3>
            </div>
            {(!data?.contractSummaries || data.contractSummaries.length === 0) ? (
              <p className="text-sm text-muted-foreground">No Contract Summary issued yet.</p>
            ) : (
              <div className="space-y-3">
                {data.contractSummaries.map((cs: any) => (
                  <AdminCsRow key={cs.id} cs={cs} />
                ))}
              </div>
            )}
          </Card>

          <Card className="border-2 border-foreground p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5" />
              <h3 className="font-display uppercase text-base">Customer files</h3>
            </div>
            {(!data?.files || data.files.length === 0) ? (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              <div className="space-y-2">
                {data.files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between border-2 border-foreground/20 p-3">
                    <div>
                      <div className="font-medium text-sm">{file.file_name}</div>
                      <div className="text-xs text-muted-foreground">{file.file_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function AdminCsRow({ cs }: { cs: any }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const accepted = cs.status === "accepted";

  const download = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-summary-pdf", {
        body: { contract_summary_id: cs.id },
      });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      const url = (data as any)?.signed_url;
      if (!url) throw new Error("no_signed_url");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Couldn't open PDF", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const fmt = (v: any) => v ? format(new Date(v), "dd MMM yyyy HH:mm") : "—";
  const shortSha = cs.pdf_sha256 ? `${cs.pdf_sha256.slice(0, 8)}…${cs.pdf_sha256.slice(-6)}` : "—";

  return (
    <div className="border-2 border-foreground p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-sm">{cs.cs_number}</span>
            <Badge variant="outline" className="border-2 border-foreground capitalize">v{cs.version} · {cs.status}</Badge>
            {accepted && (
              <Badge className="border-2 border-primary bg-primary/10 text-primary gap-1">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{cs.plan_name} — £{Number(cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo (incl VAT)</div>
        </div>
        <Button variant="outline" size="sm" className="border-2 border-foreground" onClick={download} disabled={downloading}>
          <Download className="h-4 w-4 mr-2" />
          {downloading ? "Opening…" : "Download PDF"}
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-2">
          <Mail className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Sent:</span>
          <span className="font-medium">{fmt(cs.emailed_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Accepted:</span>
          <span className="font-medium">{fmt(cs.accepted_at)}</span>
        </div>
        <div className="sm:col-span-2 flex items-start gap-2 break-all">
          <span className="text-muted-foreground">SHA-256:</span>
          <code className="font-mono text-[10px]">{shortSha}</code>
        </div>
      </div>
    </div>
  );
}

function AdminPrRow({ pr, comms }: { pr: any; comms: any[] }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const isPaid = pr.status === "paid" || pr.status === "completed";
  const fmt = (v: any) => v ? format(new Date(v), "dd MMM yyyy HH:mm") : "—";

  const resendReceipt = async () => {
    setBusy("receipt");
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-received-email", {
        body: { payment_request_id: pr.id, force: true },
      });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      toast({ title: "Receipt email sent" });
    } catch (e) {
      toast({ title: "Couldn't send receipt", description: String((e as Error).message), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const openReceipt = () => window.open(`/dashboard/receipt/${pr.id}`, "_blank", "noopener,noreferrer");

  return (
    <div className="border-2 border-foreground p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm">{pr.payment_request_number}</span>
            <Badge variant="outline" className="border-2 border-foreground capitalize">{pr.status}</Badge>
            {isPaid && pr.webhook_verified && (
              <Badge className="border-2 border-primary bg-primary/10 text-primary gap-1">
                <CheckCircle2 className="h-3 w-3" /> Webhook verified
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">£{Number(pr.amount ?? 0).toFixed(2)} {pr.currency} · {pr.customer_email}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPaid && (
            <>
              <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={openReceipt}>
                <Download className="h-4 w-4 mr-2" /> Receipt
              </Button>
              <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={resendReceipt} disabled={busy === "receipt"}>
                <Mail className="h-4 w-4 mr-2" />{busy === "receipt" ? "Sending…" : "Resend receipt email"}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span className="text-muted-foreground">Paid:</span> <span className="font-medium">{fmt(pr.paid_at)}</span></div>
        <div><span className="text-muted-foreground">Opened:</span> <span className="font-medium">{fmt(pr.last_opened_at)}</span></div>
        {pr.provider_payment_id && <div className="sm:col-span-2 break-all"><span className="text-muted-foreground">Provider txn:</span> <code className="font-mono">{pr.provider_payment_id}</code></div>}
      </div>
      {comms.length > 0 && (
        <div className="pt-2 border-t border-foreground/20">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Email log</div>
          <ul className="text-xs space-y-1">
            {comms.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                <span>{c.template_name}</span>
                <Badge variant="outline" className="border border-foreground/40 capitalize text-[10px]">{c.status}</Badge>
                <span className="text-muted-foreground">{fmt(c.sent_at || c.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
