import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { journey2, quoteTokenStore, type Catalogue, type Journey2Session } from "@/lib/journey2/client";
import Journey2Progress from "./steps/Journey2Progress";
import OrderSummaryCard from "./steps/OrderSummaryCard";
import AddressStep from "./steps/AddressStep";
import PlanStep from "./steps/PlanStep";
import RouterStep from "./steps/RouterStep";
import ExtrasStep from "./steps/ExtrasStep";
import DetailsStep from "./steps/DetailsStep";
import StartDateStep from "./steps/StartDateStep";
import BillingStep from "./steps/BillingStep";
import AgreementStep from "@/pages/quote/journey/AgreementStep";
import ReviewStep, { CompletedStep } from "@/pages/quote/journey/ReviewStep";

const SELECTION_STEPS = ["address", "plan", "router", "extras", "details", "start_date", "billing"] as const;
type SelectionStep = typeof SELECTION_STEPS[number];

/**
 * Journey 2 — one continuous ordering flow.
 *
 * Steps 1-5 are owned by the Journey 2 session. From the contract step onwards
 * the order is materialised into the existing quote/order_journey services and
 * the production-hardened contract, start date, Direct Debit and submission
 * steps are reused unchanged.
 */
export default function OrderJourney() {
  const { token } = useParams();
  const { toast } = useToast();
  const [session, setSession] = useState<Journey2Session | null>(null);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [quoteToken, setQuoteToken] = useState<string | null>(null);
  const [journeyState, setJourneyState] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backStep, setBackStep] = useState<SelectionStep | null>(null);
  const finalisedRef = useRef(false);
  const appliedRef = useRef(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // ── Load session + catalogue ───────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    if (!token) return null;
    const res = await journey2.get(token);
    if (!res?.ok || !res.session) {
      setError(res?.error ?? "session_not_found");
      return null;
    }
    setSession(res.session);
    return res.session;
  }, [token]);

  const loadQuoteJourney = useCallback(async (qt: string) => {
    const { data } = await supabase.functions.invoke("journey-state", { body: { token: qt, action: "get" } });
    if ((data as any)?.ok) setJourneyState(data);
    return data as any;
  }, []);

  const enterContractPhase = useCallback(async (s: Journey2Session) => {
    if (!token) return;
    const cached = quoteTokenStore.get(s.id);
    let qt = cached;
    if (!qt) {
      const prep = await journey2.prepareContract(token);
      if (!prep?.ok || !prep.quote_token) {
        setError(prep?.error ?? "contract_prepare_failed");
        return;
      }
      qt = prep.quote_token;
      quoteTokenStore.set(s.id, qt);
    }
    setQuoteToken(qt);
    const st = await loadQuoteJourney(qt);
    if (!st?.ok) {
      // A cached token can be stale after a session resume — re-prepare once.
      const prep = await journey2.prepareContract(token);
      if (prep?.quote_token) {
        quoteTokenStore.set(s.id, prep.quote_token);
        setQuoteToken(prep.quote_token);
        await loadQuoteJourney(prep.quote_token);
      }
    }
  }, [token, loadQuoteJourney]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, cat] = await Promise.all([
        loadSession(),
        journey2.catalogue().then((r) => r?.catalogue ?? null).catch(() => null),
      ]);
      setCatalogue(cat);
      if (s && !(SELECTION_STEPS as readonly string[]).includes(s.current_step)) {
        await enterContractPhase(s);
      }
      setLoading(false);
    })();
  }, [loadSession, enterContractPhase]);

  // Mirror the completed order back onto the Journey 2 session exactly once.
  useEffect(() => {
    const done = journeyState?.journey?.status === "completed" || journeyState?.journey?.current_step === "complete";
    if (!done || !token || finalisedRef.current) return;
    finalisedRef.current = true;
    journey2.finalise(token).catch(() => { /* non-blocking */ });
  }, [journeyState?.journey?.status, journeyState?.journey?.current_step, token]);

  const refreshQuoteJourney = useCallback(async () => {
    if (quoteToken) await loadQuoteJourney(quoteToken);
  }, [quoteToken, loadQuoteJourney]);

  /**
   * Journey 2 captured the start date and Direct Debit before the contract, so
   * they are applied to the shared services the moment acceptance is recorded.
   */
  const applyPostContract = useCallback(async () => {
    if (!token || !quoteToken || appliedRef.current) return;
    appliedRef.current = true;
    setApplyError(null);
    const res = await journey2.applyPostContract(token, quoteToken).catch(() => null);
    if (!res?.ok) {
      appliedRef.current = false;
      setApplyError(res?.message ?? "We couldn't finish setting up your billing just now. Please try again.");
    }
    await refreshQuoteJourney();
  }, [token, quoteToken, refreshQuoteJourney]);

  const onContractAccepted = useCallback(async () => {
    await applyPostContract();
  }, [applyPostContract]);

  const save = async (step: SelectionStep, payload: Record<string, unknown>) => {
    if (!token || saving) return;
    setSaving(true);
    try {
      const res = await journey2.saveStep(token, step, payload);
      if (!res?.ok || !res.session) {
        toast({
          title: res?.error === "not_orderable_online" ? "We'll price this with you" : "Couldn't save that",
          description: res?.message ?? "Please check your answers and try again.",
          variant: "destructive",
        });
        if (res?.redirect) window.location.assign(res.redirect);
        return;
      }
      setBackStep(null);
      setSession(res.session);
      if (!(SELECTION_STEPS as readonly string[]).includes(res.session.current_step)) {
        await enterContractPhase(res.session);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your order…</p>
        </div>
      </Layout>
    );
  }

  if (error || !session) {
    return (
      <Layout>
        <SEO title="Order not found | OCCTA Limited" description="This order link is no longer valid." canonical="/order" noIndex />
        <section className="container mx-auto px-4 py-16 max-w-xl text-center border-4 border-foreground">
          <h1 className="font-display uppercase text-2xl mb-3">
            {error === "session_expired" ? "This link has expired" : "Order not found"}
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            Nothing has been charged. Start again and your prices will be exactly the same, or let us finish it with you.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild><a href="/order">Start again</a></Button>
            <Button asChild variant="outline"><a href="tel:08002606626">Call 0800 260 6626</a></Button>
          </div>
        </section>
      </Layout>
    );
  }

  const activeStep = (backStep ?? session.current_step) as string;
  const inSelection = (SELECTION_STEPS as readonly string[]).includes(activeStep);
  const contractStep: string = journeyState?.journey?.current_step ?? "agreement";
  const displayStep = inSelection ? activeStep : (journeyState ? contractStep : "contract");

  return (
    <Layout>
      <SEO
        title="Complete your OCCTA order | OCCTA Limited"
        description="Your secure OCCTA order — exact prices, clear contract terms and Direct Debit set up before your order is placed."
        canonical="/order"
        noIndex
      />
      <section className="container mx-auto px-4 py-10 max-w-5xl">
        <Journey2Progress current={displayStep} />
        {session.test_session && (
          <p className="mb-4 border-2 border-foreground p-3 text-xs font-display uppercase tracking-widest">
            Test session — this order is marked internally as a test.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
          <div>
            {inSelection && activeStep === "address" && (
              <AddressStep session={session} saving={saving} onSave={(p) => save("address", p)} />
            )}
            {inSelection && activeStep === "plan" && catalogue && (
              <PlanStep catalogue={catalogue} session={session} saving={saving}
                onSave={(p) => save("plan", p)} onBack={() => setBackStep("address")} />
            )}
            {inSelection && activeStep === "router" && catalogue && (
              <RouterStep catalogue={catalogue} session={session} saving={saving}
                onSave={(p) => save("router", p)} onBack={() => setBackStep("plan")} />
            )}
            {inSelection && activeStep === "extras" && catalogue && (
              <ExtrasStep catalogue={catalogue} session={session} saving={saving}
                onSave={(p) => save("extras", p)} onBack={() => setBackStep("router")} />
            )}
            {inSelection && activeStep === "details" && (
              <DetailsStep session={session} saving={saving}
                onSave={(p) => save("details", p)} onBack={() => setBackStep("extras")} />
            )}
            {inSelection && !catalogue && activeStep !== "address" && activeStep !== "details" && (
              <div className="border-4 border-foreground p-6">
                <p className="font-display uppercase text-lg mb-2">Prices are briefly unavailable</p>
                <p className="text-sm text-muted-foreground">
                  We only ever show exact prices. Please refresh, or call 0800 260 6626 and we'll complete your order with you.
                </p>
              </div>
            )}

            {!inSelection && !journeyState && (
              <div className="border-4 border-foreground p-6 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" aria-hidden="true" />
                <p className="font-display uppercase text-lg mb-1">Preparing your contract</p>
                <p className="text-sm text-muted-foreground">
                  We're generating your Contract Summary and Contract Information. Nothing is agreed until you accept it.
                </p>
              </div>
            )}

            {!inSelection && journeyState?.ok && quoteToken && (
              <>
                {(contractStep === "quote" || contractStep === "agreement") && (
                  <AgreementStep token={quoteToken} quote={journeyState.quote} onAccepted={refreshQuoteJourney} />
                )}
                {contractStep === "start_date" && (
                  <StartDateStep token={quoteToken} journey={journeyState.journey} onSaved={refreshQuoteJourney} />
                )}
                {contractStep === "payment" && (
                  <PaymentStep
                    token={quoteToken}
                    quote={journeyState.quote}
                    journey={journeyState.journey}
                    paymentMethod={journeyState.payment_method}
                    ddProviderTemplateAvailable={journeyState.dd_provider_template_available}
                    onSaved={refreshQuoteJourney}
                  />
                )}
                {contractStep === "review" && (
                  <ReviewStep
                    token={quoteToken}
                    quote={journeyState.quote}
                    journey={journeyState.journey}
                    paymentMethod={journeyState.payment_method}
                    onSubmitted={refreshQuoteJourney}
                  />
                )}
                {(contractStep === "complete" || journeyState.journey?.status === "completed") && (
                  <CompletedStep
                    orderNumber={journeyState.submitted_order?.order_number ?? null}
                    token={quoteToken}
                    cancellationWindow={journeyState.cancellation_window}
                    onChanged={refreshQuoteJourney}
                  />
                )}
              </>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("open-ai-chat"));
                  setTimeout(() => window.dispatchEvent(new CustomEvent("ai-chat-seed", {
                    detail: { message: "I'm placing an OCCTA order online. Can you explain this step?" },
                  })), 250);
                }}
                className="text-xs underline text-muted-foreground hover:text-foreground"
              >
                Stuck? Ask Ollie
              </button>
            </div>
          </div>

          <OrderSummaryCard session={session} />
        </div>
      </section>
    </Layout>
  );
}