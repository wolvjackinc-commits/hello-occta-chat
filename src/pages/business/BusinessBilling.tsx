import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileText, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePdf } from "@/lib/generateInvoicePdf";

type Invoice = {
  id: string;
  invoice_number: string | null;
  total: number | null;
  subtotal: number | null;
  vat_total: number | null;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
};

const statusVariant = (s: string | null) => {
  const key = (s ?? "").toLowerCase();
  if (key === "paid") return "bg-green-100 text-green-800";
  if (key === "overdue") return "bg-red-100 text-red-800";
  if (key === "sent" || key === "issued") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-700";
};

const BusinessBilling = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (!u) { setLoading(false); return; }
      const { data: rows } = await supabase
        .from("invoices")
        .select("id,invoice_number,total,subtotal,vat_total,status,issue_date,due_date,billing_period_start,billing_period_end,created_at")
        .eq("user_id", u.id)
        .order("issue_date", { ascending: false, nullsFirst: false })
        .limit(200);
      setInvoices((rows ?? []) as unknown as Invoice[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => invoices.filter((inv) => {
    if (status !== "all" && (inv.status ?? "").toLowerCase() !== status) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (inv.invoice_number ?? "").toLowerCase().includes(q);
  }), [invoices, status, search]);

  const totals = useMemo(() => {
    const outstanding = invoices
      .filter((i) => (i.status ?? "").toLowerCase() !== "paid")
      .reduce((sum, i) => sum + Number(i.total ?? 0), 0);
    const paidYtd = invoices
      .filter((i) => (i.status ?? "").toLowerCase() === "paid" && i.issue_date && new Date(i.issue_date).getFullYear() === new Date().getFullYear())
      .reduce((sum, i) => sum + Number(i.total ?? 0), 0);
    return { outstanding, paidYtd, count: invoices.length };
  }, [invoices]);

  const download = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      // Fetch full invoice + lines + profile, then generate PDF via existing helper.
      const [invRes, linesRes, profileRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", invoice.id).maybeSingle(),
        supabase.from("invoice_lines").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: true }),
        user ? supabase.from("profiles").select("*").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (invRes.error || !invRes.data) throw invRes.error ?? new Error("invoice_missing");
      const inv: any = invRes.data;
      const profile: any = profileRes.data ?? {};
      const lines = (linesRes.data as any[]) ?? [];
      generateInvoicePdf({
        invoiceNumber: inv.invoice_number,
        customerName: profile.full_name || profile.business_company_name || "Customer",
        customerEmail: profile.email || "",
        accountNumber: profile.account_number || "",
        postcode: profile.postcode || "",
        issueDate: inv.issue_date,
        dueDate: inv.due_date ?? undefined,
        status: inv.status,
        lines: lines.map((l) => ({
          description: l.description ?? "",
          qty: Number(l.qty ?? 1),
          unit_price: Number(l.unit_price ?? 0),
          line_total: Number(l.line_total ?? 0),
          vat_rate: l.vat_rate != null ? Number(l.vat_rate) : undefined,
        })),
        subtotal: Number(inv.subtotal ?? 0),
        vatTotal: Number(inv.vat_total ?? 0),
        total: Number(inv.total ?? 0),
        notes: inv.notes ?? undefined,
        vatEnabled: inv.vat_enabled !== false,
        vatRate: inv.vat_rate != null ? Number(inv.vat_rate) : 20,
      });
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message, variant: "destructive" });
    }
    setDownloading(null);
  };

  return (
    <Layout>
      <SEO title="Business Billing" description="Business invoices, payment history, and downloads." canonical="/business/billing" />
      <section className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl mb-2">Business billing</h1>
          <p className="text-muted-foreground">One place for all your invoices. Auto-emailed on the 1st of every month. Ex-VAT figures on your quote; VAT itemised here.</p>
        </div>

        {!user && !loading && (
          <div className="border-4 border-foreground bg-secondary p-6 shadow-brutal text-center">
            <p className="mb-4">Sign in to view your business invoices.</p>
            <Link to="/auth?next=/business/billing"><Button variant="hero">Sign in</Button></Link>
          </div>
        )}

        {user && loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}

        {user && !loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="border-4 border-foreground bg-background p-4 shadow-brutal">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div>
                <div className="font-display text-3xl">£{totals.outstanding.toFixed(2)}</div>
              </div>
              <div className="border-4 border-foreground bg-background p-4 shadow-brutal">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Paid this year</div>
                <div className="font-display text-3xl">£{totals.paidYtd.toFixed(2)}</div>
              </div>
              <div className="border-4 border-foreground bg-background p-4 shadow-brutal">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total invoices</div>
                <div className="font-display text-3xl">{totals.count}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search invoice number…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-4 border-foreground bg-background shadow-brutal overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      <FileText className="w-8 h-8 mx-auto mb-2" />
                      No invoices yet — your first invoice will appear here after activation.
                    </TableCell></TableRow>
                  )}
                  {filtered.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoice_number ?? inv.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.billing_period_start && inv.billing_period_end
                          ? `${format(new Date(inv.billing_period_start), "dd MMM")} – ${format(new Date(inv.billing_period_end), "dd MMM")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{inv.issue_date ? format(new Date(inv.issue_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell className="text-xs">{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">£{Number(inv.total ?? 0).toFixed(2)}</TableCell>
                      <TableCell><Badge className={statusVariant(inv.status)}>{inv.status ?? "—"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {(inv.status ?? "").toLowerCase() !== "paid" && (
                            <Button size="sm" variant="hero" onClick={() => navigate(`/pay-invoice?id=${inv.id}`)}>Pay</Button>
                          )}
                          <Button size="sm" variant="outline" disabled={downloading === inv.id} onClick={() => download(inv)}>
                            {downloading === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Download className="w-3 h-3 mr-1" /> PDF</>}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Invoices are auto-emailed to your billing contact on issue. Missing one? Check spam or <Link to="/business/support" className="underline">raise a ticket</Link>.
            </p>
          </>
        )}
      </section>
    </Layout>
  );
};

export default BusinessBilling;