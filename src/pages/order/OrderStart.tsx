import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { journey2 } from "@/lib/journey2/client";

/**
 * /order — journey entry point.
 *
 * The server decides which journey this visitor gets. Journey 1 visitors are
 * sent to the existing quote-led route; Journey 2 visitors get a session token
 * and continue at /order/:token.
 */
export default function OrderStart() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await journey2.start({ adminTest: params.get("test") === "1" });
        if (res?.token) {
          navigate(`/order/${res.token}`, { replace: true });
          return;
        }
        if (res?.redirect) {
          navigate(res.redirect, { replace: true });
          return;
        }
        setMessage(res?.message ?? "Online ordering is briefly unavailable. Call 0800 260 6626 and we'll complete your order with you.");
        setFailed(true);
      } catch {
        setMessage("We couldn't start your order just now. Please try again, or call 0800 260 6626.");
        setFailed(true);
      }
    })();
  }, [navigate, params]);

  return (
    <Layout>
      <SEO
        title="Order OCCTA broadband online | OCCTA Limited"
        description="Order OCCTA broadband in one go. Exact prices including VAT, clear contract terms, and Direct Debit set up securely before your order is placed."
        canonical="/order"
      />
      <section className="container mx-auto px-4 py-16 max-w-xl text-center">
        {!failed ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-4" aria-hidden="true" />
            <h1 className="font-display uppercase text-2xl mb-2">Setting up your order</h1>
            <p className="text-sm text-muted-foreground">One moment — we're preparing your exact prices.</p>
          </>
        ) : (
          <div className="border-4 border-foreground p-8">
            <h1 className="font-display uppercase text-2xl mb-3">Let's finish this by phone</h1>
            <p className="text-sm text-muted-foreground mb-5">{message}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild><a href="tel:08002606626">Call 0800 260 6626</a></Button>
              <Button asChild variant="outline"><a href="mailto:hello@occta.co.uk">Email us</a></Button>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}