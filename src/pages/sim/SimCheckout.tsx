import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { loadSimCatalogue, formatGbp, type SimPlanPublic, type SimSettingsPublic } from "@/lib/sim/catalogue";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const SimCheckout = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const planId = params.get("plan_id") ?? "";

  const [settings, setSettings] = useState<SimSettingsPublic | null>(null);
  const [plan, setPlan] = useState<SimPlanPublic | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [simType, setSimType] = useState<"esim" | "physical">("physical");
  const [esimBrand, setEsimBrand] = useState("");
  const [esimModel, setEsimModel] = useState("");
  const [esimEid, setEsimEid] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState({ line1: "", line2: "", city: "", postcode: "" });
  const [numberChoice, setNumberChoice] = useState<"keep" | "new" | "new_with_stac" | "provide_later">("new");
  const [currentMsisdn, setCurrentMsisdn] = useState("");
  const [currentProvider, setCurrentProvider] = useState("");
  const [pacCode, setPacCode] = useState("");
  const [stacCode, setStacCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState({ line1: "", line2: "", city: "", postcode: "" });
  const [businessName, setBusinessName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "direct_debit">("card");
  const [consentDetails, setConsentDetails] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentDd, setConsentDd] = useState(false);
  const [ddHolder, setDdHolder] = useState("");
  const [ddSort, setDdSort] = useState("");
  const [ddAccount, setDdAccount] = useState("");
  const [ddBank, setDdBank] = useState("");
  const [ddUkAccount, setDdUkAccount] = useState(false);
  const [ddPayerAuth, setDdPayerAuth] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      // Guest allowed for card checkout; DD requires sign-in (enforced at
      // step 5).
      if (data.session) {
        setEmail(data.session.user.email ?? "");
        setIsSignedIn(true);
      }
      setAuthChecked(true);
      const cat = await loadSimCatalogue();
      setSettings(cat.settings);
      const p = cat.plans.find((x) => x.id === planId) ?? null;
      setPlan(p);
      if (p && !p.physical_sim_available) setSimType("esim");
      if (p && !p.esim_available) setSimType("physical");
    })();
  }, [planId]);

  const firstPayment = useMemo(() => {
    if (!plan) return 0;
    if (paymentMethod !== "card") return 0;
    const delivery = simType === "physical" ? plan.delivery_fee_minor : 0;
    return (plan.first_payment_minor || plan.monthly_price_minor) + delivery;
  }, [plan, paymentMethod, simType]);

  const isBusiness = plan?.customer_segment === "business";

  if (!authChecked || !plan || !settings) {
    return <Layout><div className="container mx-auto px-4 py-16">Loading checkout…</div></Layout>;
  }

  if (!settings.standalone_enabled) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-xl">
          <h1 className="text-3xl font-display uppercase mb-3">Not available</h1>
          <p className="text-muted-foreground">SIM-only ordering is closed right now. Please contact support.</p>
        </div>
      </Layout>
    );
  }

  const canContinue = () => {
    if (step === 1) return true;
    if (step === 2) {
      if (simType === "physical") return !!(deliveryAddress.line1 && deliveryAddress.city && deliveryAddress.postcode);
      return !!(esimBrand && esimModel);
    }
    if (step === 3) {
      if (numberChoice === "keep") return !!currentMsisdn;
      return true;
    }
    if (step === 4) {
      if (isBusiness && !businessName) return false;
      return !!(fullName && email && billingAddress.line1 && billingAddress.postcode);
    }
    if (step === 5) {
      if (paymentMethod === "direct_debit") {
        if (!isSignedIn) return false;
        return !!(ddHolder && /^\d{6}$/.test(ddSort) && /^\d{8}$/.test(ddAccount) && ddBank && ddUkAccount && ddPayerAuth);
      }
      return true;
    }
    if (step === 6) {
      const dd = paymentMethod === "direct_debit" ? consentDd : true;
      return consentDetails && consentTerms && dd;
    }
    return false;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const { data, error } = await supabase.functions.invoke("sim-create-order", {
        body: {
          plan_id: plan.id,
          customer_segment: plan.customer_segment,
          business_name: isBusiness ? businessName : null,
          company_number: isBusiness ? (companyNumber || null) : null,
          vat_number: isBusiness ? (vatNumber || null) : null,
          sim_type: simType,
          esim_device_brand: simType === "esim" ? esimBrand : null,
          esim_device_model: simType === "esim" ? esimModel : null,
          esim_eid: simType === "esim" ? esimEid : null,
          delivery_address: simType === "physical" ? deliveryAddress : null,
          number_choice: numberChoice,
          current_msisdn: currentMsisdn || null,
          current_provider: currentProvider || null,
          pac_code: pacCode || null,
          stac_code: stacCode || null,
          full_name: fullName,
          email,
          phone,
          billing_address: billingAddress,
          payment_method: paymentMethod,
          dd_details: paymentMethod === "direct_debit" ? {
            account_holder_name: ddHolder,
            sort_code: ddSort,
            account_number: ddAccount,
            bank_name: ddBank,
            uk_account_confirmed: ddUkAccount,
            payer_authorised_confirmed: ddPayerAuth,
            guarantee_acknowledged: consentDd,
          } : undefined,
          consent: {
            details_confirmed: consentDetails,
            terms_accepted: consentTerms,
            dd_guarantee_accepted: consentDd,
            timestamp: new Date().toISOString(),
          },
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const orderId = (data as any).order_id as string;
      const invoiceId = (data as any).invoice_id as string | null;
      const orderToken = (data as any).order_token as string | undefined;
      const successPath = `/sim/order-success/${orderId}${orderToken ? `?t=${orderToken}` : ""}`;

      // Card: start Worldpay HPP now
      if (paymentMethod === "card" && invoiceId) {
        const returnUrl = `${window.location.origin}/pay?invoiceId=${invoiceId}&sim_order_id=${orderId}${orderToken ? `&t=${orderToken}` : ""}`;
        const wp = await supabase.functions.invoke("worldpay-payment", {
          body: {
            action: "create-payment-session",
            invoiceId,
            currency: "GBP",
            customerEmail: email,
            returnUrl,
            paymentOrigin: window.location.origin,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (wp.error) throw wp.error;
        const checkoutUrl = (wp.data as any)?.checkoutUrl;
        if (!checkoutUrl) throw new Error("No checkout URL");
        window.location.assign(checkoutUrl);
        return;
      }

      // DD path: go to order success (admin picks up)
      navigate(successPath);
    } catch (e) {
      console.error(e);
      toast({ title: "Could not place order", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <p className="text-xs font-display uppercase tracking-widest text-muted-foreground">Step {step} of 6</p>
          <h1 className="text-3xl font-display uppercase">SIM checkout</h1>
          <p className="text-sm text-muted-foreground">{plan.name} · {formatGbp(plan.monthly_price_minor)}/mo</p>
        </div>

        <div className="card-brutal bg-card p-6 space-y-5">
          {step === 1 && (
            <div>
              <h2 className="font-display text-xl uppercase mb-3">Confirm plan</h2>
              <div className="border-2 border-foreground p-4">
                <p className="font-display text-lg">{plan.name}</p>
                <p className="text-sm">{plan.data_label} · {plan.calls_label} · {plan.texts_label}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {plan.is_rolling ? "Rolling monthly" : `${plan.min_term_months}-month term`}
                </p>
                <p className="mt-3 font-display text-2xl">{formatGbp(plan.monthly_price_minor)}/mo</p>
              </div>
              <Button variant="link" className="mt-2 p-0" onClick={() => navigate("/sim")}>Change plan</Button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-xl uppercase mb-3">SIM type</h2>
              <RadioGroup value={simType} onValueChange={(v) => setSimType(v as "esim" | "physical")}>
                {settings.esim_enabled && plan.esim_available && (
                  <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                    <RadioGroupItem value="esim" />
                    <div>
                      <p className="font-display">eSIM</p>
                      <p className="text-xs text-muted-foreground">Activated by QR after admin approval. We email you activation details.</p>
                    </div>
                  </label>
                )}
                {settings.physical_sim_enabled && plan.physical_sim_available && (
                  <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                    <RadioGroupItem value="physical" />
                    <div>
                      <p className="font-display">Physical SIM</p>
                      <p className="text-xs text-muted-foreground">Posted to your delivery address. Typical dispatch {settings.dispatch_lead_time_days}–4 working days after order confirmed.</p>
                    </div>
                  </label>
                )}
              </RadioGroup>

              {simType === "esim" && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div><Label>Device brand *</Label><Input value={esimBrand} onChange={(e) => setEsimBrand(e.target.value)} /></div>
                  <div><Label>Device model *</Label><Input value={esimModel} onChange={(e) => setEsimModel(e.target.value)} /></div>
                  <div className="col-span-2"><Label>EID (optional)</Label><Input value={esimEid} onChange={(e) => setEsimEid(e.target.value)} /></div>
                </div>
              )}

              {simType === "physical" && (
                <div className="space-y-3 mt-4">
                  <div><Label>Delivery address line 1 *</Label><Input value={deliveryAddress.line1} onChange={(e) => setDeliveryAddress({ ...deliveryAddress, line1: e.target.value })} /></div>
                  <div><Label>Line 2</Label><Input value={deliveryAddress.line2} onChange={(e) => setDeliveryAddress({ ...deliveryAddress, line2: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>City *</Label><Input value={deliveryAddress.city} onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })} /></div>
                    <div><Label>Postcode *</Label><Input value={deliveryAddress.postcode} onChange={(e) => setDeliveryAddress({ ...deliveryAddress, postcode: e.target.value.toUpperCase() })} /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-xl uppercase mb-3">Number</h2>
              <RadioGroup value={numberChoice} onValueChange={(v) => setNumberChoice(v as any)}>
                <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                  <RadioGroupItem value="keep" />
                  <div>
                    <p className="font-display">Keep my current number</p>
                    <p className="text-xs text-muted-foreground">A PAC lets us transfer your existing mobile number from your old provider to OCCTA. You can usually request it by texting PAC to 65075.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                  <RadioGroupItem value="new" />
                  <div><p className="font-display">Give me a new number</p></div>
                </label>
                <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                  <RadioGroupItem value="new_with_stac" />
                  <div>
                    <p className="font-display">New number and close old service</p>
                    <p className="text-xs text-muted-foreground">A STAC lets you switch provider without keeping your old number. You can usually request it by texting STAC to 75075.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                  <RadioGroupItem value="provide_later" />
                  <div><p className="font-display">I'll decide later</p></div>
                </label>
              </RadioGroup>

              {numberChoice === "keep" && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div><Label>Current number *</Label><Input value={currentMsisdn} onChange={(e) => setCurrentMsisdn(e.target.value)} /></div>
                  <div><Label>Current provider</Label><Input value={currentProvider} onChange={(e) => setCurrentProvider(e.target.value)} /></div>
                  <div className="col-span-2"><Label>PAC (if you have it)</Label><Input value={pacCode} onChange={(e) => setPacCode(e.target.value.toUpperCase())} /></div>
                </div>
              )}
              {numberChoice === "new_with_stac" && (
                <div className="mt-4"><Label>STAC (if you have it)</Label><Input value={stacCode} onChange={(e) => setStacCode(e.target.value.toUpperCase())} /></div>
              )}
              <p className="text-xs text-muted-foreground mt-3">We won't promise an exact port date — we confirm scheduling once your PAC/STAC is validated.</p>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-xl uppercase mb-3">{isBusiness ? "Business details" : "Your details"}</h2>
              {isBusiness && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2"><Label>Business name *</Label><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
                  <div><Label>Company number (optional)</Label><Input value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} /></div>
                  <div><Label>VAT number (optional)</Label><Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} /></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>{isBusiness ? "Contact person *" : "Full name *"}</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>{isBusiness ? "Business phone" : "Mobile"}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="col-span-2 pt-3 border-t-2 border-foreground/20">
                  <p className="font-display uppercase text-sm mb-2">{isBusiness ? "Business address" : "Billing address"}</p>
                </div>
                <div className="col-span-2"><Label>Line 1 *</Label><Input value={billingAddress.line1} onChange={(e) => setBillingAddress({ ...billingAddress, line1: e.target.value })} /></div>
                <div className="col-span-2"><Label>Line 2</Label><Input value={billingAddress.line2} onChange={(e) => setBillingAddress({ ...billingAddress, line2: e.target.value })} /></div>
                <div><Label>City *</Label><Input value={billingAddress.city} onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })} /></div>
                <div><Label>Postcode *</Label><Input value={billingAddress.postcode} onChange={(e) => setBillingAddress({ ...billingAddress, postcode: e.target.value.toUpperCase() })} /></div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="font-display text-xl uppercase mb-3">Payment method</h2>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "direct_debit")}>
                <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                  <RadioGroupItem value="card" />
                  <div>
                    <p className="font-display">Card now (Worldpay Hosted Payment)</p>
                    <p className="text-xs text-muted-foreground">First payment {formatGbp(firstPayment)} taken now. Card details are handled by Worldpay — we never store them.</p>
                  </div>
                </label>
                {settings.direct_debit_enabled && (
                  <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer">
                    <RadioGroupItem value="direct_debit" />
                    <div>
                      <p className="font-display">Direct Debit</p>
                      <p className="text-xs text-muted-foreground">Nothing charged now. Bank details are encrypted and reviewed by our team. Requires a signed-in account.</p>
                    </div>
                  </label>
                )}
              </RadioGroup>

              {paymentMethod === "direct_debit" && !isSignedIn && (
                <div className="mt-4 border-2 border-foreground p-3 text-sm">
                  <p className="font-display uppercase mb-2">Sign in required</p>
                  <p className="text-muted-foreground mb-3">Direct Debit is tied to your OCCTA account. Please sign in or create one to continue.</p>
                  <Button variant="hero" onClick={() => navigate(`/auth?redirect=/sim/checkout?plan_id=${planId}`)}>Sign in / create account</Button>
                </div>
              )}

              {paymentMethod === "direct_debit" && isSignedIn && (
                <div className="mt-4 space-y-3">
                  <p className="font-display uppercase text-sm">Direct Debit details</p>
                  <div><Label>Account holder name *</Label><Input value={ddHolder} onChange={(e) => setDdHolder(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Sort code * (6 digits)</Label><Input value={ddSort} inputMode="numeric" maxLength={6} onChange={(e) => setDdSort(e.target.value.replace(/\D/g, ""))} /></div>
                    <div><Label>Account number * (8 digits)</Label><Input value={ddAccount} inputMode="numeric" maxLength={8} onChange={(e) => setDdAccount(e.target.value.replace(/\D/g, ""))} /></div>
                  </div>
                  <div><Label>Bank name *</Label><Input value={ddBank} onChange={(e) => setDdBank(e.target.value)} /></div>
                  <label className="flex items-start gap-2 text-xs"><Checkbox checked={ddUkAccount} onCheckedChange={(v) => setDdUkAccount(!!v)} /> This is a UK bank account eligible for Direct Debit.</label>
                  <label className="flex items-start gap-2 text-xs"><Checkbox checked={ddPayerAuth} onCheckedChange={(v) => setDdPayerAuth(!!v)} /> I am the account holder or authorised to set up Direct Debits on this account.</label>
                  <p className="text-xs text-muted-foreground">Your bank details are AES-256 encrypted at rest. We only display the last 4 digits of your account and last 2 of your sort code.</p>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="font-display text-xl uppercase mb-3">Review &amp; confirm</h2>
              <div className="text-sm space-y-1 mb-4 border-2 border-foreground p-3">
                <p><strong>Plan:</strong> {plan.name} ({formatGbp(plan.monthly_price_minor)}/mo)</p>
                <p><strong>SIM type:</strong> {simType === "esim" ? "eSIM" : "Physical SIM"}</p>
                <p><strong>Number:</strong> {numberChoice.replace("_", " ")}</p>
                <p><strong>Payment:</strong> {paymentMethod === "card" ? `Card — ${formatGbp(firstPayment)} first payment` : "Direct Debit (arranged after confirmation)"}</p>
                <p><strong>Billing starts:</strong> when admin marks your SIM service live.</p>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm"><Checkbox checked={consentDetails} onCheckedChange={(v) => setConsentDetails(!!v)} /> I confirm the details above are correct.</label>
                <label className="flex items-start gap-2 text-sm"><Checkbox checked={consentTerms} onCheckedChange={(v) => setConsentTerms(!!v)} /> I accept OCCTA's terms for SIM-only services.</label>
                {paymentMethod === "direct_debit" && (
                  <label className="flex items-start gap-2 text-sm"><Checkbox checked={consentDd} onCheckedChange={(v) => setConsentDd(!!v)} /> I authorise OCCTA to arrange a Direct Debit mandate under the Direct Debit Guarantee.</label>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t-2 border-foreground/20">
            <Button variant="outline" onClick={() => setStep((s) => (Math.max(1, s - 1) as Step))} disabled={step === 1 || submitting}>Back</Button>
            {step < 6 && (
              <Button variant="hero" onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canContinue()}>Continue</Button>
            )}
            {step === 6 && (
              <Button variant="hero" onClick={submit} disabled={!canContinue() || submitting}>
                {submitting ? "Placing order…" : paymentMethod === "card" ? "Pay & place order" : "Place order"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SimCheckout;