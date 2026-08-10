import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Json } from "@/integrations/supabase/types";
import { Copy, ArrowLeft, Pencil, StickyNote, Route as RouteIcon, AlertTriangle, ExternalLink, Send, Lock as LockIcon, Eye } from "lucide-react";
import { format } from "date-fns";
import { AddServiceDialog } from "@/components/admin/AddServiceDialog";
import { CustomerEditDialog } from "@/components/admin/CustomerEditDialog";
import { CustomerDDSection } from "@/components/admin/CustomerDDSection";
import { CustomerBillingSettings } from "@/components/admin/CustomerBillingSettings";
import { JourneyInternalNotes } from "@/components/admin/JourneyInternalNotes";
import { OrderOperationsCard } from "@/components/admin/OrderOperationsCard";
import { CancellationCasesCard } from "@/components/admin/CancellationCasesCard";
import { CustomerActionsCard } from "@/components/admin/CustomerActionsCard";
import { CustomerSendEmailDialog } from "@/components/admin/CustomerSendEmailDialog";
import { CustomerCreateTicketDialog } from "@/components/admin/CustomerCreateTicketDialog";
import { BillingSchedulePanel } from "@/components/admin/BillingSchedulePanel";
import { useEffect } from "react";

function ReconciliationWarnings(_: { userId: string }) { return null; }
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { logAudit } from "@/lib/audit";
import { normalizeAccountNumber, isAccountNumberValid } from "@/lib/account";
import { Download, FileText, Lock, CheckCircle2, Mail } from "lucide-react";

/**
 * Route wrapper. Legacy bookmarks may still be UUID-based, so the UUID
 * resolution lives in its own component. This keeps every hook in the main
 * detail component unconditional (Rules of Hooks).
 */
export const AdminCustomerDetail = () => {
  const { accountNumber: rawAccountNumber } = useParams<{ accountNumber: string }>();
  const navigate = useNavigate();
  const accountNumber = rawAccountNumber ? normalizeAccountNumber(rawAccountNumber) : null;

  const looksLikeUuid =
    !!rawAccountNumber &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      rawAccountNumber,
    );
  const { data: legacyLookup, isLoading: legacyLoading } = useQuery({
    queryKey: ["admin-customer-uuid-fallback", rawAccountNumber],
    enabled: looksLikeUuid,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, account_number")
        .eq("id", rawAccountNumber!)
        .maybeSingle();
      return data ?? null;
    },
  });

  if (looksLikeUuid) {
    if (legacyLoading) {
      return (
        <div className="p-6 text-sm text-muted-foreground">
          Resolving customer…
        </div>
      );
    }
    const acct = legacyLookup?.account_number
      ? normalizeAccountNumber(legacyLookup.account_number)
      : null;
    if (acct && isAccountNumberValid(acct)) {
      // Redirect bookmarks silently to the canonical route.
      navigate(`/admin/customers/${acct}`, { replace: true });
      return null;
    }
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/customers")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Button>
        <Card className="border-2 border-destructive p-8 text-center bg-destructive/5">
          <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-3" />
          <p className="font-display text-lg mb-2">Account reconciliation required</p>
          <p className="text-sm text-muted-foreground">
            This customer has no account number yet. Open the reconciliation queue to assign one before continuing.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/customers")}>
            Back to customers
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <CustomerDetailContent
      accountNumber={accountNumber}
      rawAccountNumber={rawAccountNumber}
    />
  );
};

const CustomerDetailContent = ({
  accountNumber,
  rawAccountNumber,
}: {
  accountNumber: string | null;
  rawAccountNumber?: string;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<any | null>(null);

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
        .select("id, cs_number, status, version, quote_id, plan_name, monthly_price_incl_vat, emailed_at, accepted_at, pdf_storage_key, pdf_sha256, is_information_update, supersedes_id, created_at, updated_at")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      const { data: paymentRequests } = await supabase
        .from("payment_requests")
        .select("id, payment_request_number, status, amount, currency, paid_at, failed_at, last_opened_at, created_at, webhook_verified, contract_summary_id, provider_payment_id, customer_email")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const prIds = (paymentRequests ?? []).map((r: any) => r.id);
      const csIds = (contractSummaries ?? []).map((c: any) => c.id);
      const commFilters = [`user_id.eq.${userId}`];
      if (profileData.email) commFilters.push(`recipient_email.eq.${profileData.email}`);
      if (prIds.length) commFilters.push(`payment_request_id.in.(${prIds.join(",")})`);

      const { data: allComms } = await (supabase as any)
        .from("communications_log")
        .select("id, payment_request_id, invoice_id, user_id, template_name, recipient_email, status, sent_at, error_message, created_at, subject, body_html, metadata")
        .or(commFilters.join(","))
        .order("created_at", { ascending: false })
        .limit(200);
      const prComms = (allComms ?? []).filter((c: any) => c.payment_request_id);

      // Quote requests + final quotes + customer_proceeded events
      const [{ data: quoteRequests }, { data: quotes }] = await Promise.all([
        (supabase as any).from("quote_requests")
          .select("id, reference, status, service_interest, customer_type, postcode, address_line_1, address_line_2, created_at, final_quote_id")
          .eq("customer_id", userId).order("created_at", { ascending: false }),
        (supabase as any).from("quotes")
          .select("id, quote_number, status, plan_name, monthly_gross, customer_intent_proceeded_at, quote_request_id, created_at, public_token_hash")
          .eq("customer_id", userId).order("created_at", { ascending: false }),
      ]);

      // Look up DOB / postcode from any available source to suppress false "missing" warnings
      const [{ data: contractAcc }, { data: guestOrder }, { data: emailLog }] = await Promise.all([
        supabase.from("contract_acceptances").select("date_of_birth, accepted_at").eq("customer_id", userId).order("accepted_at", { ascending: false }).limit(1),
        profileData.email
          ? supabase.from("guest_orders").select("date_of_birth, postcode").eq("email", profileData.email).order("created_at", { ascending: false }).limit(1)
          : Promise.resolve({ data: [] as any[] } as any),
        profileData.email
          ? (supabase as any).from("email_send_log").select("id, message_id, template_name, recipient_email, status, created_at, metadata").eq("recipient_email", profileData.email).order("created_at", { ascending: false }).limit(200)
          : Promise.resolve({ data: [] as any[] } as any),
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
        contractAcceptances: contractAcc ?? [],
        guestOrders: guestOrder ?? [],
        emailLog: emailLog ?? [],
      };
    },
  });

  const overview = useMemo(() => data?.profile, [data?.profile]);
  const services = useMemo(() => data?.services ?? [], [data?.services]);
  const invoices = useMemo(() => data?.invoices ?? [], [data?.invoices]);

  // Auto-backfill profile DOB/postcode from other sources so admins don't have to re-key.
  const altPostcode = useMemo(() => {
    return (
      (data?.quoteRequests ?? [])[0]?.postcode ||
      (data?.orders ?? [])[0]?.postcode ||
      (data?.guestOrders ?? [])[0]?.postcode ||
      null
    );
  }, [data?.quoteRequests, data?.orders, data?.guestOrders]);
  const altDob = useMemo(() => {
    return (
      (data?.contractAcceptances ?? [])[0]?.date_of_birth ||
      (data?.guestOrders ?? [])[0]?.date_of_birth ||
      null
    );
  }, [data?.contractAcceptances, data?.guestOrders]);

  useEffect(() => {
    if (!overview?.id) return;
    const patch: Record<string, any> = {};
    if (!overview.postcode && altPostcode) patch.postcode = altPostcode;
    if (!overview.date_of_birth && altDob) patch.date_of_birth = altDob;
    if (Object.keys(patch).length > 0) {
      (supabase.from("profiles") as any)
        .update(patch)
        .eq("id", overview.id)
        .then(({ error }) => {
          if (!error) refetch();
          else console.warn("profile backfill failed", error);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview?.id, altPostcode, altDob, overview?.postcode, overview?.date_of_birth]);

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
          {overview.account_number === "OCC70547490" && (
            <Button
              variant="outline"
              className="border-2 border-foreground"
              onClick={() => navigate("/admin/legacy-remediation")}
            >
              Legacy remediation
            </Button>
          )}
          <Button
            variant="outline"
            className="border-2 border-foreground"
            onClick={() => {
              const ident = overview.account_number || overview.email;
              window.dispatchEvent(new CustomEvent("open-ai-chat"));
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("ai-chat-seed", {
                  detail: { message: `Open Customer 360 for ${ident}` },
                }));
              }, 250);
            }}
          >
            Ask Copilot
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
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="quote-contract">Quote &amp; Contract</TabsTrigger>
          <TabsTrigger value="payments">Payments &amp; Receipts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="services">Services &amp; Orders</TabsTrigger>
          <TabsTrigger value="billing">Billing / DD</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <Customer360Header
              profile={overview}
              cs={(data?.contractSummaries ?? [])[0] ?? null}
              pr={(data?.paymentRequests ?? [])[0] ?? null}
              quotes={data?.quotes ?? []}
              altPostcode={altPostcode}
              altDob={altDob}
            />
            <CustomerActionsCard
              customer={{
                id: overview.id,
                full_name: overview.full_name,
                email: overview.email,
                account_number: overview.account_number,
              }}
              invoices={invoices as any}
              onChanged={refetch}
            />
            <ReconciliationWarnings userId={overview.id} />
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
                  <div className="text-xs uppercase text-muted-foreground">Email</div>
                  <div className="text-sm font-medium break-all">{overview.email || "—"}</div>
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

        <TabsContent value="quote-contract" className="mt-4 space-y-4">
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Quote requests &amp; final quotes</h3>
            {(!data?.quoteRequests || data.quoteRequests.length === 0) && (data?.quotes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No quote requests yet.</p>
            ) : (
              <div className="space-y-3">
                {(data?.quotes ?? []).map((q: any) => (
                  <QuoteRow key={q.id} q={q} qr={(data?.quoteRequests ?? []).find((qr: any) => qr.id === q.quote_request_id) ?? null} />
                ))}
                {(data?.quoteRequests ?? []).filter((qr: any) => !(data?.quotes ?? []).some((q: any) => q.quote_request_id === qr.id)).map((qr: any) => (
                  <div key={qr.id} className="border-2 border-foreground/30 p-3 text-sm">
                    <div className="font-mono text-xs">{qr.reference}</div>
                    <div className="text-muted-foreground text-xs">Request · {qr.service_interest} · {qr.customer_type} · {qr.postcode}</div>
                    <div className="text-xs">Status: <span className="font-medium capitalize">{qr.status}</span></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Contract Summaries</h3>
            {(!data?.contractSummaries || data.contractSummaries.length === 0) ? (
              <p className="text-sm text-muted-foreground">No Contract Summary issued yet. Generate one from the Quotes page when a quote is approved.</p>
            ) : (
              <div className="space-y-3">
                {data.contractSummaries.map((cs: any) => (
                  <AdminCsRow key={cs.id} cs={cs} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="mt-4 space-y-4">
          <ReconciliationWarnings userId={overview.id} />
          {(data?.orders ?? []).filter((o: any) => o.occta_order_number).length === 0 ? (
            <Card className="border-2 border-foreground p-4 text-sm text-muted-foreground">
              No canonical orders yet. Once the customer completes the journey, an OCCTA order appears here.
            </Card>
          ) : (
            (data?.orders ?? [])
              .filter((o: any) => o.occta_order_number)
              .map((o: any) => <OrderOperationsCard key={o.id} orderId={o.id} />)
          )}
          <div className="pt-2">
            <h3 className="font-display uppercase text-sm mb-2">In-life cancellation cases</h3>
            <CancellationCasesCard customerId={overview.id} />
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-3">
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Payment requests</h3>
            {(!data?.paymentRequests || data.paymentRequests.length === 0) ? (
              <p className="text-sm text-muted-foreground">No payment requests yet. Create one from an accepted Contract Summary in the Quote &amp; Contract tab or Quotes page.</p>
            ) : (
              <div className="space-y-3">
                {data.paymentRequests.map((pr: any) => (
                  <AdminPrRow key={pr.id} pr={pr} comms={(data.prComms || []).filter((c: any) => c.payment_request_id === pr.id)} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          <Card className="border-2 border-foreground p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5" />
              <h3 className="font-display uppercase text-base">Customer documents</h3>
            </div>
            <UnifiedDocuments
              cs={data?.contractSummaries ?? []}
              prs={data?.paymentRequests ?? []}
              invoices={invoices}
              files={data?.files ?? []}
            />
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">All emails sent to this customer — automated and manual — appear here.</p>
            <div className="flex gap-2">
              <CustomerSendEmailDialog
                customer={{ id: overview.id, full_name: overview.full_name, email: overview.email, account_number: overview.account_number }}
                onSent={refetch}
              />
              <CustomerCreateTicketDialog
                customer={{ id: overview.id, full_name: overview.full_name, email: overview.email, account_number: overview.account_number }}
                onCreated={refetch}
              />
            </div>
          </div>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Communications log</h3>
            {(() => {
              // Merge email_send_log + communications_log, dedupe by message_id / id
              const fromLegacy = (data?.allComms ?? []).map((c: any) => ({
                id: c.id,
                key: `legacy:${c.id}`,
                when: c.sent_at ?? c.created_at,
                template: c.template_name,
                recipient: c.recipient_email,
                status: c.status,
                related: c.payment_request_id ? "Payment request" : c.invoice_id ? "Invoice" : "—",
                subject: c.subject || (c.metadata as any)?.subject || null,
                body_html: c.body_html,
              }));
              const seenMsg = new Set<string>();
              const fromLog = (data?.emailLog ?? [])
                .filter((r: any) => {
                  if (!r.message_id) return true;
                  if (seenMsg.has(r.message_id)) return false;
                  seenMsg.add(r.message_id);
                  return true;
                })
                .map((r: any) => ({
                  id: r.id,
                  key: `log:${r.id}`,
                  when: r.created_at,
                  template: r.template_name,
                  recipient: r.recipient_email,
                  status: r.status,
                  related: (r.metadata as any)?.subject ?? "—",
                  subject: (r.metadata as any)?.subject ?? null,
                }));
              const merged = [...fromLog, ...fromLegacy].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
              if (merged.length === 0) {
                return <p className="text-sm text-muted-foreground">No emails sent to this customer yet.</p>;
              }
              return (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-4 border-foreground">
                    <TableHead className="font-display uppercase">When</TableHead>
                    <TableHead className="font-display uppercase">Template</TableHead>
                    <TableHead className="font-display uppercase">Recipient</TableHead>
                    <TableHead className="font-display uppercase">Status</TableHead>
                    <TableHead className="font-display uppercase">Related</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merged.map((c: any) => (
                    <TableRow key={c.key} className="border-b-2 border-foreground/15">
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(c.when), "dd MMM HH:mm")}</TableCell>
                      <TableCell className="text-xs">{c.template}</TableCell>
                      <TableCell className="text-xs break-all">{c.recipient ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-2 capitalize ${c.status === "failed" || c.status === "dlq" ? "border-destructive text-destructive" : c.status === "suppressed" ? "border-warning text-warning" : "border-foreground"}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>{c.subject || c.related}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-2 border-foreground whitespace-nowrap"
                            onClick={() => setPreviewEmail(c)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View email
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              );
            })()}
          </Card>
          <Dialog open={!!previewEmail} onOpenChange={(open) => !open && setPreviewEmail(null)}>
            <DialogContent className="border-2 border-foreground max-w-3xl max-h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-6 pb-3 border-b-2 border-foreground/10">
                <DialogTitle className="font-display uppercase">
                  {previewEmail?.subject || previewEmail?.template || "Email preview"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  To <span className="font-mono">{previewEmail?.recipient}</span>
                  {previewEmail?.when && <> · sent {format(new Date(previewEmail.when), "dd MMM yyyy HH:mm:ss")}</>}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
                {previewEmail?.body_html ? (
                  <iframe
                    title="Sent email preview"
                    sandbox=""
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f0;color:#0d0d0d;padding:24px}</style></head><body>${previewEmail.body_html}</body></html>`}
                    className="w-full h-[600px] bg-background border-2 border-foreground"
                  />
                ) : (
                  <div className="border-2 border-foreground bg-background p-4 space-y-3 text-sm">
                    <div>
                      <p className="font-display text-xs uppercase text-muted-foreground">Subject</p>
                      <p className="font-medium">{previewEmail?.subject || previewEmail?.related || "—"}</p>
                    </div>
                    <div>
                      <p className="font-display text-xs uppercase text-muted-foreground">Stored body</p>
                      <p className="text-muted-foreground">This older log entry did not store the full rendered email body. New emails will show the complete sent email here.</p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Support tickets</h3>
            {(!data?.tickets || data.tickets.length === 0) ? (
              <p className="text-sm text-muted-foreground">No tickets found.</p>
            ) : (
              <div className="space-y-2">
                {data.tickets.map((t: any) => (
                  <div key={t.id} className="border-2 border-foreground/20 p-3">
                    <div className="text-sm font-medium">{t.subject}</div>
                    <div className="text-xs text-muted-foreground">Status: {t.status} · {formatDate(t.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4 space-y-3">
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Services</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Customers only see live services once the admin sets the status to <strong>active</strong>. Until then they see order progress only.
            </p>
            <div className="flex justify-end mb-2">
              <AddServiceDialog
                trigger={<Button size="sm" variant="outline" className="border-2 border-foreground">Add service (manual)</Button>}
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
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-4 border-foreground">
                    <TableHead className="font-display uppercase">Type</TableHead>
                    <TableHead className="font-display uppercase">Status</TableHead>
                    <TableHead className="font-display uppercase">Identifier</TableHead>
                    <TableHead className="font-display uppercase">Supplier ref</TableHead>
                    <TableHead className="font-display uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id} className="border-b-2 border-foreground/20">
                      <TableCell className="capitalize">{service.service_type}</TableCell>
                      <TableCell><Badge variant="outline" className="border-2 border-foreground capitalize">{service.status}</Badge></TableCell>
                      <TableCell>{getServiceIdentifier(service.service_type, service.identifiers)}</TableCell>
                      <TableCell>{service.supplier_reference || "—"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" disabled={updatingServiceId === service.id} onClick={() => updateServiceStatus(service.id, "suspended")} className="border-2 border-foreground">Suspend</Button>
                        <Button variant="outline" size="sm" disabled={updatingServiceId === service.id} onClick={() => updateServiceStatus(service.id, "active")} className="border-2 border-foreground">Reactivate</Button>
                        <Button variant="outline" size="sm" disabled={updatingServiceId === service.id} onClick={() => updateServiceStatus(service.id, "cancelled")} className="border-2 border-foreground">Cancel</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Orders</h3>
            {(!data?.orders || data.orders.length === 0) ? (
              <p className="text-sm text-muted-foreground">No orders found.</p>
            ) : data.orders.map((order: any) => (
              <div key={order.id} className="border-2 border-foreground/20 p-3 mb-2">
                <div className="font-medium text-sm">{order.service_type} · {order.plan_name}</div>
                <div className="text-xs text-muted-foreground">Status: {order.status} · {formatDate(order.created_at)}</div>
              </div>
            ))}
          </Card>
          <JourneyInternalNotes customerId={overview.id} />
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-4">
          <BillingSchedulePanel userId={overview.id} />
          <CustomerBillingSettings
            userId={overview.id}
            accountNumber={overview.account_number}
            onUpdate={refetch}
          />
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Direct Debit</h3>
            <CustomerDDSection userId={overview.id} accountNumber={overview.account_number} />
          </Card>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Invoices</h3>
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
                      <TableCell><Badge variant="outline" className="border-2 border-foreground capitalize">{invoice.status}</Badge></TableCell>
                      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell className="text-right">£{Number(invoice.total).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <Card className="border-2 border-foreground p-4">
            <h3 className="font-display text-lg mb-3">Automation status</h3>
            <TooltipProvider>
              <div className="grid sm:grid-cols-2 gap-2">
                <DisabledAutomationButton label="Create monthly invoice" />
                <DisabledAutomationButton label="Create DD mandate" />
                <DisabledAutomationButton label="Activate service" />
                <DisabledAutomationButton label="Submit supplier order" />
                <DisabledAutomationButton label="Trigger provisioning" />
              </div>
            </TooltipProvider>
            <p className="text-xs text-muted-foreground mt-3">Billing / DD / supplier / provisioning automation is not enabled yet — use manual process.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ----------------------------- helpers ----------------------------- */

function Customer360Header({ profile, cs, pr, quotes, altPostcode, altDob }: { profile: any; cs: any; pr: any; quotes: any[]; altPostcode?: string | null; altDob?: string | null }) {
  const warnings: string[] = [];
  if (!cs) warnings.push("No Contract Summary issued");
  else if (cs.status !== "accepted") warnings.push("Contract Summary not yet accepted");
  if (pr && pr.status !== "paid" && pr.status !== "completed") {
    const ageDays = (Date.now() - new Date(pr.created_at).getTime()) / 86400000;
    if (ageDays > 7) warnings.push(`Payment request ${pr.payment_request_number} unpaid > 7 days`);
  }
  if (!profile.date_of_birth && !altDob) warnings.push("Date of birth missing");
  if (!profile.postcode && !altPostcode) warnings.push("Postcode missing");

  const stage = !quotes.length
    ? "Lead"
    : !cs
      ? "Quote issued"
      : cs.status !== "accepted"
        ? "Contract Summary pending"
        : !pr
          ? "Awaiting payment request"
            : pr.status === "paid" || pr.status === "completed"
              ? (pr.webhook_verified ? "Paid & verified" : "Paid")
              : "Payment pending";

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs uppercase text-muted-foreground font-display">Stage:</span>
        <Badge variant="outline" className="border-2 border-foreground">{stage}</Badge>
      </div>
      {warnings.length > 0 && (
        <ul className="text-xs space-y-1">
          {warnings.map((w) => (
            <li key={w} className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3" /> {w}
            </li>
          ))}
        </ul>
      )}
      {warnings.length === 0 && <p className="text-xs text-muted-foreground">No outstanding warnings.</p>}
    </Card>
  );
}

function QuoteRow({ q, qr }: { q: any; qr: any }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", { body: { quote_id: q.id, force: true } });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      toast({ title: "Quote email sent" });
    } catch (e) {
      toast({ title: "Couldn't resend quote", description: String((e as Error).message), variant: "destructive" });
    } finally { setBusy(false); }
  };
  return (
    <div className="border-2 border-foreground p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-sm">{q.quote_number}</span>
            <Badge variant="outline" className="border-2 border-foreground capitalize">{q.status}</Badge>
            {q.customer_intent_proceeded_at && <Badge className="border-2 border-primary bg-primary/10 text-primary">Proceeded</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {q.plan_name} · £{Number(q.monthly_gross ?? 0).toFixed(2)}/mo · req {qr?.reference ?? "—"}
          </div>
          {q.customer_intent_proceeded_at && (
            <div className="text-[10px] text-muted-foreground">Customer proceeded: {format(new Date(q.customer_intent_proceeded_at), "dd MMM yyyy HH:mm")}</div>
          )}
        </div>
        <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={resend} disabled={busy}>
          <Send className="h-3 w-3 mr-1" />{busy ? "Sending…" : "Resend email"}
        </Button>
      </div>
    </div>
  );
}

function UnifiedDocuments({ cs, prs, invoices, files }: { cs: any[]; prs: any[]; invoices: any[]; files: any[] }) {
  const rows: Array<{ key: string; kind: string; label: string; ts: string | null; action: React.ReactNode }> = [];
  cs.forEach((c) => {
    rows.push({
      key: `cs-${c.id}`,
      kind: "Contract Summary",
      label: `${c.cs_number} · ${c.plan_name}`,
      ts: c.accepted_at ?? c.emailed_at ?? c.created_at,
      action: <AdminCsDownloadButton csId={c.id} />,
    });
  });
  prs.filter((p) => p.status === "paid" || p.status === "completed").forEach((p) => {
    rows.push({
      key: `rec-${p.id}`,
      kind: "Receipt",
      label: `${p.payment_request_number} · £${Number(p.amount ?? 0).toFixed(2)}`,
      ts: p.paid_at,
      action: (
        <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => window.open(`/dashboard/receipt/${p.id}`, "_blank", "noopener,noreferrer")}>
          <ExternalLink className="h-3 w-3 mr-1" /> Open
        </Button>
      ),
    });
  });
  invoices.forEach((i: any) => {
    rows.push({
      key: `inv-${i.id}`,
      kind: "Invoice",
      label: `${i.invoice_number} · £${Number(i.total ?? 0).toFixed(2)}`,
      ts: i.issue_date,
      action: <span className="text-xs text-muted-foreground">—</span>,
    });
  });
  files.forEach((f: any) => {
    rows.push({
      key: `file-${f.id}`,
      kind: "Uploaded",
      label: f.file_name,
      ts: f.created_at ?? null,
      action: <span className="text-xs text-muted-foreground">{f.file_type}</span>,
    });
  });
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No documents yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b-4 border-foreground">
          <TableHead className="font-display uppercase">Kind</TableHead>
          <TableHead className="font-display uppercase">Reference</TableHead>
          <TableHead className="font-display uppercase">Date</TableHead>
          <TableHead className="font-display uppercase text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key} className="border-b-2 border-foreground/15">
            <TableCell className="text-xs"><Badge variant="outline" className="border-2 border-foreground">{r.kind}</Badge></TableCell>
            <TableCell className="text-sm">{r.label}</TableCell>
            <TableCell className="text-xs">{r.ts ? format(new Date(r.ts), "dd MMM yyyy HH:mm") : "—"}</TableCell>
            <TableCell className="text-right">{r.action}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AdminCsDownloadButton({ csId }: { csId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-summary-pdf", { body: { contract_summary_id: csId } });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      const url = (data as any)?.signed_url;
      if (!url) throw new Error("no_signed_url");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Couldn't open PDF", description: String((e as Error).message), variant: "destructive" });
    } finally { setBusy(false); }
  };
  return (
    <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={open} disabled={busy}>
      <Download className="h-3 w-3 mr-1" />{busy ? "…" : "PDF"}
    </Button>
  );
}

const MFO_STATUSES = ["ready_for_manual_order","order_entered_in_supplier_portal","supplier_acknowledged","installation_pending","active","cancelled"] as const;

function FulfilmentSection({ mfos, prs, css, customerId, accountNumber, onChanged }: { mfos: any[]; prs: any[]; css: any[]; customerId: string; accountNumber: string | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const paidPrs = prs.filter((p: any) => (p.status === "paid" || p.status === "completed") && p.contract_summary_id);
  const eligible = paidPrs.filter((p: any) => !mfos.some((m: any) => m.payment_request_id === p.id));

  const create = async (pr: any) => {
    setBusy(`create-${pr.id}`);
    try {
      const cs = css.find((c: any) => c.id === pr.contract_summary_id);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("manual_fulfilment_orders").insert({
        customer_id: customerId,
        account_number: accountNumber,
        payment_request_id: pr.id,
        contract_summary_id: pr.contract_summary_id,
        selected_product_label: cs?.plan_name ?? null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: "Manual fulfilment tracker created" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Couldn't create tracker", description: e?.message ?? "unknown", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const updateStatus = async (m: any, status: string) => {
    setBusy(`status-${m.id}`);
    try {
      const { error } = await (supabase as any).from("manual_fulfilment_orders").update({ status }).eq("id", m.id);
      if (error) throw error;
      toast({ title: "Tracker status updated" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      {mfos.length === 0 && eligible.length === 0 && (
        <p className="text-sm text-muted-foreground">No paid payment request yet — manual fulfilment becomes available once a payment is verified.</p>
      )}
      {mfos.map((m: any) => {
        const pr = prs.find((p: any) => p.id === m.payment_request_id);
        return (
          <div key={m.id} className="border-2 border-foreground p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-display">{pr?.payment_request_number ?? m.payment_request_id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">{m.selected_product_label ?? "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-muted-foreground">Status</span>
                <Select value={m.status} onValueChange={(v) => updateStatus(m, v)} disabled={busy === `status-${m.id}`}>
                  <SelectTrigger className="w-[230px] border-2 border-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MFO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
      })}
      {eligible.map((pr: any) => (
        <div key={pr.id} className="border-2 border-foreground/30 border-dashed p-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-mono">{pr.payment_request_number}</span> · paid · no tracker
          </div>
          <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => create(pr)} disabled={busy === `create-${pr.id}`}>
            {busy === `create-${pr.id}` ? "Creating…" : "Create manual fulfilment tracker"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function TaskRow({ task, onChanged }: { task: any; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const update = async (status: string) => {
    setBusy(true);
    try {
      const patch: any = { status };
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
      const { error } = await (supabase as any).from("admin_tasks").update(patch).eq("id", task.id);
      if (error) throw error;
      toast({ title: "Task updated" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };
  return (
    <div className="border-2 border-foreground/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{task.task_number} · {task.title}</div>
          <div className="text-xs text-muted-foreground">Priority: {task.priority} · Created {format(new Date(task.created_at), "dd MMM HH:mm")}</div>
        </div>
        <Select value={task.status} onValueChange={update} disabled={busy}>
          <SelectTrigger className="w-[180px] border-2 border-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["open","in_progress","waiting_customer","waiting_supplier","resolved","cancelled"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function DisabledAutomationButton({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block w-full">
          <Button variant="outline" disabled className="border-2 border-foreground w-full justify-start opacity-60 cursor-not-allowed">
            <LockIcon className="h-3 w-3 mr-2" />{label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Not automated yet — use manual process.</TooltipContent>
    </Tooltip>
  );
}

function AdminCsRow({ cs }: { cs: any }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const isInfoUpdate = cs.is_information_update === true;
  const accepted = !isInfoUpdate && cs.status === "accepted";

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
            {isInfoUpdate ? (
              <Badge variant="outline" className="border-2 border-foreground">v{cs.version} · information update</Badge>
            ) : (
              <Badge variant="outline" className="border-2 border-foreground capitalize">v{cs.version} · {cs.status}</Badge>
            )}
            {accepted && (
              <Badge className="border-2 border-primary bg-primary/10 text-primary gap-1">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
          </div>
          {isInfoUpdate && (
            <div className="text-xs mt-1 border-2 border-foreground bg-muted/40 px-2 py-1 max-w-[560px]">
              <span className="font-semibold">Current Contract Information — information update only / no reacceptance required.</span>{" "}
              Records-only refresh. Not pending signature. The customer's original accepted Contract Summary remains the
              binding agreement and stays on file unchanged.
            </div>
          )}
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
          <span className="font-medium">{isInfoUpdate ? "N/A — information update" : fmt(cs.accepted_at)}</span>
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
  const isUnpaidLive = !isPaid && !["cancelled", "failed"].includes(pr.status);
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

  const resendLink = async () => {
    setBusy("resend");
    try {
      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: { action: "admin-resend-link", request_id: pr.id },
      });
      if (error || !(data as any)?.success) throw new Error((data as any)?.error || error?.message || "Failed");
      toast({ title: "Link resent with fresh token" });
    } catch (e: any) {
      toast({ title: "Couldn't resend", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const voidRequest = async () => {
    const reason = window.prompt("Reason for voiding this request? (optional)") ?? undefined;
    if (reason === null) return; // Esc
    setBusy("void");
    try {
      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: { action: "admin-void-request", request_id: pr.id, reason },
      });
      if (error || !(data as any)?.success) throw new Error((data as any)?.error || error?.message || "Failed");
      toast({ title: "Payment request voided" });
    } catch (e: any) {
      toast({ title: "Couldn't void", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

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
          {isUnpaidLive && (
            <>
              <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={resendLink} disabled={busy === "resend"}>
                <Send className="h-4 w-4 mr-2" />{busy === "resend" ? "Resending…" : "Resend link"}
              </Button>
              <Button size="sm" variant="outline" className="border-2 border-destructive text-destructive" onClick={voidRequest} disabled={busy === "void"}>
                {busy === "void" ? "Voiding…" : "Void"}
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
