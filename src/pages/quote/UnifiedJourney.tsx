import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import QuoteView from "./QuoteView";
import JourneyProgress, { type JourneyStepKey } from "./journey/JourneyProgress";
import QuoteStep from "./journey/QuoteStep";
import DeclineDialog from "./journey/DeclineDialog";

type JourneyState = {
  id: string;
  current_step: JourneyStepKey;
  status: string;
  decline_reason: string | null;
  preferred_start_date: string | null;
  payment_method: string | null;
  billing_anchor_day: number | null;
  contract_accepted_at: string | null;
  cooling_off_ends_at: string | null;
  completed_at: string | null;
  contract_summary_id: string | null;
};

type StateResponse = {
  ok: boolean;
  unified_journey_enabled: boolean;
  quote: any;
  journey: JourneyState | null;
  contract_summary_available: boolean;
  contract_summary_status: string | null;
  error?: string;
};

/**
 * Phase A/B shell for the unified quote-to-order journey. Falls back to the
 * legacy single-page `QuoteView` while `unified_journey_enabled` is off,
 * so live traffic is unaffected until ops flips the flag.
 */
export default function UnifiedJourney() {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declining, setDeclining] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("journey-state", {
        body: { token, action: "get" },
      });
      if (error || (data as any)?.error) {
        setError((data as any)?.error || error?.message || "not_found");
      } else {
        setState(data as StateResponse);
      }
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleContinue = async () => {
    if (!token || continuing) return;
    setContinuing(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-state", {
        body: { token, action: "continue" },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't continue",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        setState(data as StateResponse);
        toast({
          title: "Got it — moving you on",
          description: "We're preparing your Contract Summary for the next step.",
        });
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setContinuing(false);
    }
  };

  const handleDecline = async (reason_code: string, reason_text: string) => {
    if (!token || declining) return;
    setDeclining(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-decline", {
        body: { token, reason_code, reason_text },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't record decline",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        setDeclineOpen(false);
        await load();
        toast({ title: "Quote declined", description: "We've recorded your choice. No charges were taken." });
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      </Layout>
    );
  }

  if (error || !state?.ok) {
    return (
      <Layout>
        <section className="container mx-auto p-12 max-w-xl text-center">
          <h1 className="font-display uppercase text-2xl mb-3">Quote not found</h1>
          <p className="text-sm text-muted-foreground">
            This quote link is invalid or has expired. Please contact <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a>.
          </p>
        </section>
      </Layout>
    );
  }

  // Feature flag off → render the verified legacy single-page experience untouched.
  if (!state.unified_journey_enabled) {
    return <QuoteView />;
  }

  const step: JourneyStepKey = state.journey?.current_step ?? "quote";

  return (
    <Layout>
      <SEO
        title={`Your OCCTA order · Quote ${state.quote.quote_number}`}
        description="Your personalised OCCTA quote and secure order journey."
        canonical={`/quote/${token}`}
      />
      <section className="container mx-auto px-4 py-10 max-w-2xl">
        <JourneyProgress current={step} />

        {step === "quote" || state.journey?.status === "declined" ? (
          <QuoteStep
            quote={state.quote}
            journey={state.journey}
            continuing={continuing}
            declining={declining}
            onContinue={handleContinue}
            onDeclineClick={() => setDeclineOpen(true)}
          />
        ) : (
          <div className="border-4 border-foreground p-8 text-center">
            <p className="font-display uppercase text-xl mb-2">Next step coming online</p>
            <p className="text-sm text-muted-foreground">
              You've completed the quote step. The next step ({step.replace("_", " ")}) is being rolled out — we'll email you a secure link as soon as it's ready. No payment has been taken.
            </p>
          </div>
        )}
      </section>

      <DeclineDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        onConfirm={handleDecline}
        submitting={declining}
      />
    </Layout>
  );
}
