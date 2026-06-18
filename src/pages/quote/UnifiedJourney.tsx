import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import JourneyProgress, { type JourneyStepKey } from "./journey/JourneyProgress";
import QuoteStep from "./journey/QuoteStep";
import DeclineDialog from "./journey/DeclineDialog";
import AgreementStep from "./journey/AgreementStep";
import StartDateStep from "./journey/StartDateStep";
import PaymentStep from "./journey/PaymentStep";
import ReviewStep, { CompletedStep } from "./journey/ReviewStep";
import CancelledStep from "./journey/CancelledStep";

type JourneyState = {
  id: string;
  current_step: JourneyStepKey;
  status: string;
  decline_reason: string | null;
  preferred_start_date: string | null;
  start_date_selected_at: string | null;
  payment_method: string | null;
  billing_anchor_day: number | null;
  contract_accepted_at: string | null;
  cooling_off_ends_at: string | null;
  earliest_selectable_start_date: string | null;
  cooling_off_acknowledged: boolean | null;
  cooling_off_acknowledged_at: string | null;
  completed_at: string | null;
  contract_summary_id: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  linked_customer_id?: string | null;
};

type StateResponse = {
  ok: boolean;
  unified_journey_enabled: boolean;
  quote: any;
  journey: JourneyState | null;
  contract_summary_available: boolean;
  contract_summary_status: string | null;
  payment_method: any | null;
  dd_provider_template_available: boolean;
  submitted_order: { id: string; order_number: string; status: string } | null;
  cancellation_window: {
    ends_at: string | null;
    cancellable: boolean;
    cancelled_at: string | null;
    cancellation_reason: string | null;
  } | null;
  error?: string;
};

/**
 * Unified quote-to-order journey. This is the only customer journey UI.
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
        const nextState = data as StateResponse;
        setState(nextState);
        if (nextState.journey?.current_step !== "agreement") {
          await load();
        }
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
        <div className="flex justify-end -mt-2 mb-4">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-ai-chat"));
              setTimeout(() => window.dispatchEvent(new CustomEvent("ai-chat-seed", {
                detail: { message: `I'm on my OCCTA quote ${state.quote.quote_number}. Can you explain this step?` },
              })), 250);
            }}
            className="text-xs underline text-muted-foreground hover:text-foreground"
          >
            Stuck? Ask Ollie
          </button>
        </div>

        {state.journey?.status === "cancelled" ? (
          <CancelledStep
            cancelledAt={state.journey.cancelled_at ?? state.cancellation_window?.cancelled_at ?? null}
            reasonCode={state.journey.cancellation_reason ?? state.cancellation_window?.cancellation_reason ?? null}
            orderNumber={state.submitted_order?.order_number ?? null}
          />
        ) : step === "quote" || state.journey?.status === "declined" ? (
          <QuoteStep
            quote={state.quote}
            journey={state.journey}
            continuing={continuing}
            declining={declining}
            onContinue={handleContinue}
            onDeclineClick={() => setDeclineOpen(true)}
          />
        ) : step === "agreement" ? (
          <AgreementStep token={token!} quote={state.quote} onAccepted={load} />
        ) : step === "start_date" ? (
          <StartDateStep token={token!} journey={state.journey} onSaved={load} />
        ) : step === "payment" ? (
          <PaymentStep
            token={token!}
            quote={state.quote}
            journey={state.journey}
            paymentMethod={state.payment_method}
            ddProviderTemplateAvailable={state.dd_provider_template_available}
            onSaved={load}
          />
        ) : step === "review" ? (
          <ReviewStep
            token={token!}
            quote={state.quote}
            journey={state.journey}
            paymentMethod={state.payment_method}
            onSubmitted={load}
          />
        ) : step === "complete" || state.journey?.status === "completed" ? (
          <CompletedStep
            orderNumber={state.submitted_order?.order_number ?? null}
            token={token}
            cancellationWindow={state.cancellation_window}
            onChanged={load}
          />
        ) : (
          <div className="border-4 border-foreground p-8 text-center">
            <p className="font-display uppercase text-xl mb-2">Next step coming online</p>
            <p className="text-sm text-muted-foreground">
              You've completed the quote step. The next step ({String(step).replace("_", " ")}) is being rolled out — we'll email you a secure link as soon as it's ready. No payment has been taken.
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
