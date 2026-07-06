import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatGbp } from "@/lib/sim/catalogue";
import { CheckCircle2 } from "lucide-react";

const SimOrderSuccess = () => {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      // Try signed-in customer view first (RLS enforces ownership).
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        const { data } = await (supabase as any)
          .from("sim_orders_customer")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        if (data) { setOrder(data); setLoading(false); return; }
      }
      // Fall back to token-based lookup (guest checkout / just-completed order).
      if (token) {
        const enc = new TextEncoder().encode(token);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        const tokenHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        const { data } = await (supabase as any)
          .from("sim_orders_by_token")
          .select("id, order_number, plan_name_snapshot, sim_type, payment_method, status, monthly_price_minor_snapshot")
          .eq("id", orderId)
          .eq("order_token_hash", tokenHash)
          .maybeSingle();
        setOrder(data);
      }
      setLoading(false);
    })();
  }, [orderId, token]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="card-brutal bg-card p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-display uppercase mb-2">Order received</h1>
          {loading && <p className="text-muted-foreground">Loading your order…</p>}
          {!loading && order && (
            <>
              <p className="text-muted-foreground mb-4">Order number <strong>{order.order_number}</strong></p>
              <div className="text-left border-2 border-foreground p-4 mb-4 text-sm space-y-1">
                <p><strong>Plan:</strong> {order.plan_name_snapshot} — {formatGbp(order.monthly_price_minor_snapshot)}/mo</p>
                <p><strong>SIM type:</strong> {order.sim_type}</p>
                <p><strong>Payment:</strong> {order.payment_method === "card" ? "Card (Worldpay)" : "Direct Debit"}</p>
                <p><strong>Status:</strong> {order.status}</p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                {order.sim_type === "esim"
                  ? "We'll email your eSIM activation details once our team activates your service."
                  : "We'll dispatch your SIM within a few working days once approved."}
                {" "}Billing starts when admin marks your service live — you won't be charged again for what's already covered.
              </p>
            </>
          )}
          {!loading && !order && (
            <p className="text-muted-foreground mb-4">We couldn't find that order. Please check your dashboard.</p>
          )}
          <div className="flex gap-2 justify-center">
            <Link to="/dashboard"><Button variant="hero">Go to dashboard</Button></Link>
            <Link to="/support"><Button variant="outline">Contact support</Button></Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SimOrderSuccess;