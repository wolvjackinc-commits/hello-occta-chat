import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, Loader2, Lock, Printer } from "lucide-react";
import { format } from "date-fns";
import { generatePaymentReceiptPdf, type PaymentReceiptData } from "@/lib/generatePaymentReceiptPdf";

type Mode = "token" | "auth";

export default function ReceiptView({ mode }: { mode: Mode }) {
  const params = useParams();
  const [search] = useSearchParams();
  const [data, setData] = useState<PaymentReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let resp: any;
        if (mode === "token") {
          const token = params.token || search.get("token");
          if (!token) throw new Error("missing_token");
          const { data: r, error: e } = await supabase.functions.invoke("get-payment-receipt", { body: { token } });
          if (e) throw e;
          resp = r;
        } else {
          const id = params.id || search.get("id");
          if (!id) throw new Error("missing_id");
          const { data: r, error: e } = await supabase.functions.invoke("get-payment-receipt", { body: { id } });
          if (e) throw e;
          resp = r;
        }
        if (cancelled) return;
        if (resp?.error) throw new Error(resp.error);
        setData(resp.receipt);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, params.token, params.id, search]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        {loading ? (
          <div className="p-8 border-4 border-foreground bg-card flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading receipt…
          </div>
        ) : error || !data ? (
          <div className="p-8 border-4 border-foreground bg-card">
            <h1 className="font-display text-2xl mb-2">Receipt unavailable</h1>
            <p className="text-sm text-muted-foreground">
              {error === "expired" ? "This receipt link has expired." :
               error === "forbidden" ? "You don't have access to this receipt." :
               error === "not_paid" ? "No paid receipt is available yet." :
               "We couldn't load this receipt. If you think this is wrong, contact hello@occta.co.uk."}
            </p>
            <Link to="/dashboard"><Button className="mt-4" variant="outline">Back to dashboard</Button></Link>
          </div>
        ) : (
          <div className="border-4 border-foreground bg-card">
            <div className="bg-foreground text-background p-6 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-70">OCCTA Telecom</div>
                <h1 className="font-display text-3xl mt-1">Payment receipt</h1>
              </div>
              <Badge className="bg-primary text-primary-foreground border-2 border-background gap-1">
                <CheckCircle2 className="w-3 h-3" /> Paid
              </Badge>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Receipt" value={data.receipt_ref} mono />
                <Field label="Payment reference" value={data.payment_request_number} mono />
                <Field label="Paid" value={format(new Date(data.paid_at), "dd MMM yyyy, HH:mm")} />
                <Field label="Method" value={data.provider} />
              </div>
              <div className="border-4 border-foreground p-5">
                <h2 className="font-display uppercase text-sm mb-3 pb-2 border-b-2 border-foreground">Payer</h2>
                <Field label="Customer" value={data.customer_name} />
                {data.account_number && <Field label="Account" value={data.account_number} mono />}
                <Field label="Email" value={data.customer_email} />
                {data.provider_payment_id && <Field label="Transaction" value={data.provider_payment_id} mono />}
                {data.contract_summary && (
                  <>
                    <Field label="Contract Summary" value={data.contract_summary.cs_number} mono />
                    <Field label="Plan" value={data.contract_summary.plan_name} />
                  </>
                )}
              </div>
              <div className="bg-foreground text-background p-6 text-center">
                <div className="text-xs uppercase tracking-widest text-primary">Amount paid</div>
                <div className="font-display text-5xl mt-2">£{Number(data.amount).toFixed(2)}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => generatePaymentReceiptPdf(data)} className="border-4 border-foreground">
                  <Printer className="w-4 h-4 mr-2" /> Print / save PDF
                </Button>
                <Link to="/dashboard"><Button variant="outline" className="border-4 border-foreground">Back to dashboard</Button></Link>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> This receipt is derived from your verified Worldpay payment. Viewing or printing it does not change your payment status.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-1">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${mono ? "font-mono" : ""} break-all`}>{value}</div>
    </div>
  );
}