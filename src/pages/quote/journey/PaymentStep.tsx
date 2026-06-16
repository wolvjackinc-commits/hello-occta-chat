import { useMemo, useState } from "react";
import { Loader2, Building2, FileText, Check, ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DD_CONSENT =
  "I confirm that I am authorised to provide these account details and request that OCCTA LIMITED arranges payment of amounts due under my service agreement by Direct Debit. I understand that my Direct Debit is not active until OCCTA confirms setup with its payment provider.";
const INVOICE_CONSENT =
  "I confirm I want to be billed monthly by invoice and that I am responsible for paying each invoice via the secure Worldpay link by the due date.";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function formatSortCode(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}

function genUuid(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof (c as any).randomUUID === "function") return (c as any).randomUUID();
  const b = (c ?? window.crypto).getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export default function PaymentStep({
  token,
  quote,
  journey,
  paymentMethod,
  ddProviderTemplateAvailable,
  onSaved,
}: {
  token: string;
  quote: any;
  journey: any;
  paymentMethod: any | null;
  ddProviderTemplateAvailable: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [method, setMethod] = useState<"direct_debit" | "invoice_link" | null>(
    (paymentMethod?.method as any) ?? null,
  );
  const [day, setDay] = useState<number>(paymentMethod?.billing_anchor_day ?? 1);
  const [submitting, setSubmitting] = useState(false);

  // DD form state
  const [accountHolder, setAccountHolder] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [postcode, setPostcode] = useState(quote?.service_postcode ?? "");
  const [ukConfirmed, setUkConfirmed] = useState(false);
  const [payerAuthorised, setPayerAuthorised] = useState(false);
  const [ddConsent, setDdConsent] = useState(false);
  const [invConsent, setInvConsent] = useState(false);

  const monthlyGross = useMemo(
    () => (quote?.monthly_gross != null ? `£${Number(quote.monthly_gross).toFixed(2)}` : null),
    [quote?.monthly_gross],
  );

  const ddValid =
    accountHolder.trim().length >= 2 &&
    /^\d{6}$/.test(sortCode.replace(/\D/g, "")) &&
    /^\d{8}$/.test(accountNumber) &&
    bankName.trim().length >= 2 &&
    billingAddress.trim().length >= 3 &&
    postcode.trim().length >= 3 &&
    ukConfirmed &&
    payerAuthorised &&
    ddConsent;
  const invValid = invConsent;
  const formValid = method === "direct_debit" ? ddValid : method === "invoice_link" ? invValid : false;

  const submit = async () => {
    if (!method || !formValid || submitting) return;
    setSubmitting(true);
    try {
      const idempotency_key = genUuid();
      const body: any = { token, method, billing_anchor_day: day, consent: true, idempotency_key };
      if (method === "direct_debit") {
        body.dd_details = {
          account_holder_name: accountHolder.trim(),
          sort_code: sortCode.replace(/\D/g, ""),
          account_number: accountNumber.trim(),
          bank_name: bankName.trim(),
          billing_address: billingAddress.trim(),
          postcode: postcode.trim().toUpperCase(),
          uk_account_confirmed: true,
          payer_authorised_confirmed: true,
        };
      }
      const { data, error } = await supabase.functions.invoke("journey-payment-method", { body });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't save payment method",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: method === "direct_debit" ? "Direct Debit setup requested" : "Invoice billing selected",
          description: "Your preference is saved. No payment has been taken.",
        });
        onSaved();
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  // Already-saved view
  if (paymentMethod) {
    return (
      <div className="space-y-4">
        <div className="border-4 border-primary bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <Check className="w-6 h-6 text-primary mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-display uppercase">Payment method saved</p>
              {paymentMethod.method === "direct_debit" ? (
                <>
                  <p>Method: <strong>Pay monthly by Direct Debit</strong></p>
                  <p>Account holder: <strong>{paymentMethod.account_holder_name}</strong></p>
                  <p>Bank: <strong>{paymentMethod.bank_name}</strong></p>
                  <p>Sort code: <strong>**-**-{paymentMethod.masked_sort_last2}</strong> &middot; Account: <strong>****{paymentMethod.masked_account_last4}</strong></p>
                  <p>Preferred monthly collection day: <strong>{paymentMethod.billing_anchor_day}</strong></p>
                  <p className="text-xs text-muted-foreground border-l-4 border-foreground pl-3 mt-3">
                    We have securely received your Direct Debit setup request. Your Direct Debit is <strong>not active yet</strong>. OCCTA LIMITED will confirm when it has been established with our payment provider.
                  </p>
                </>
              ) : (
                <>
                  <p>Method: <strong>Receive a monthly invoice and pay online</strong></p>
                  <p>Preferred monthly invoice date: <strong>{paymentMethod.billing_anchor_day}</strong></p>
                  <p className="text-xs text-muted-foreground border-l-4 border-foreground pl-3 mt-3">
                    OCCTA will email your monthly invoice with a secure Worldpay payment link once your service is confirmed active.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full font-display uppercase"
          onClick={() => { /* allow change */ window.location.reload(); }}
        >
          Change payment method
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Method selector */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMethod("direct_debit")}
          className={`text-left border-4 p-5 transition-all ${
            method === "direct_debit" ? "border-primary bg-primary/5" : "border-foreground/30 hover:border-foreground"
          }`}
        >
          <Building2 className="w-6 h-6 mb-2" />
          <p className="font-display uppercase text-sm">Pay monthly by Direct Debit</p>
          <p className="text-xs text-muted-foreground mt-1">
            Provide your details so OCCTA LIMITED can arrange your monthly Direct Debit. We will confirm when your Direct Debit has been successfully established with our payment provider.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setMethod("invoice_link")}
          className={`text-left border-4 p-5 transition-all ${
            method === "invoice_link" ? "border-primary bg-primary/5" : "border-foreground/30 hover:border-foreground"
          }`}
        >
          <FileText className="w-6 h-6 mb-2" />
          <p className="font-display uppercase text-sm">Receive a monthly invoice and pay online</p>
          <p className="text-xs text-muted-foreground mt-1">
            OCCTA will email your monthly invoice with a secure Worldpay payment link. You will need to complete the payment manually by the due date.
          </p>
        </button>
      </div>

      {/* Billing day */}
      {method && (
        <div className="border-4 border-foreground p-5 space-y-3">
          <p className="font-display uppercase text-sm">
            Preferred monthly {method === "direct_debit" ? "collection" : "invoice"} day
          </p>
          <p className="text-xs text-muted-foreground">
            Choose any day from 1 to 31. For shorter months, we use the final calendar day.
          </p>
          <select
            value={day}
            onChange={(e) => setDay(parseInt(e.target.value, 10))}
            className="w-full h-11 border-2 border-foreground bg-background px-3"
          >
            {DAYS.map((d) => <option key={d} value={d}>Day {d}</option>)}
          </select>
        </div>
      )}

      {/* DD form */}
      {method === "direct_debit" && (
        <div className="border-4 border-foreground p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <p className="font-display uppercase text-sm">Your bank details (encrypted in transit and at rest)</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ah">Account holder name</Label>
            <Input id="ah" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Name on bank account" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sc">Sort code</Label>
              <Input id="sc" value={sortCode} onChange={(e) => setSortCode(formatSortCode(e.target.value))} placeholder="00-00-00" maxLength={8} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="an">Account number</Label>
              <Input id="an" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="12345678" maxLength={8} inputMode="numeric" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bn">Bank or building society name</Label>
            <Input id="bn" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Barclays" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ba">Billing address</Label>
            <Textarea id="ba" rows={2} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Street, town" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc">Postcode</Label>
            <Input id="pc" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" />
          </div>

          <label className="flex items-start gap-2 text-sm pt-2">
            <Checkbox checked={ukConfirmed} onCheckedChange={(v) => setUkConfirmed(v === true)} />
            <span>I confirm this is a UK bank or building society account.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={payerAuthorised} onCheckedChange={(v) => setPayerAuthorised(v === true)} />
            <span>I confirm I am authorised to use this account and to set up Direct Debits on it.</span>
          </label>
          <label className="flex items-start gap-2 text-sm border-l-4 border-foreground pl-3">
            <Checkbox checked={ddConsent} onCheckedChange={(v) => setDdConsent(v === true)} />
            <span>{DD_CONSENT}</span>
          </label>

          {ddProviderTemplateAvailable ? null : (
            <div className="flex items-start gap-2 text-xs bg-muted p-3 border-l-4 border-foreground">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                The formal Direct Debit Guarantee is not yet available on this account because OCCTA has not finished onboarding with its Direct Debit provider. This screen records your <strong>setup request</strong> only — it is <strong>not</strong> a completed Bacs Direct Debit Instruction. OCCTA will confirm by email once your Direct Debit is established with our provider.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Invoice option detail */}
      {method === "invoice_link" && (
        <div className="border-4 border-foreground p-5 space-y-3 text-sm">
          <p className="font-display uppercase text-sm">Monthly invoice details</p>
          <ul className="space-y-1 text-sm">
            <li>Monthly service amount: <strong>{monthlyGross ?? "—"}</strong> (from your locked quote)</li>
            <li>Preferred monthly invoice date: <strong>Day {day}</strong></li>
          </ul>
          <p className="text-xs text-muted-foreground border-l-4 border-foreground pl-3">
            Your first amount may be calculated pro-rata from your actual activation date. Billing starts only after OCCTA confirms your service is active. You'll enter card details securely on Worldpay's hosted page — OCCTA never stores your full card details.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={invConsent} onCheckedChange={(v) => setInvConsent(v === true)} />
            <span>{INVOICE_CONSENT}</span>
          </label>
        </div>
      )}

      <Button
        variant="hero"
        className="w-full font-display uppercase"
        disabled={!method || !formValid || submitting}
        onClick={submit}
      >
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> :
          method === "direct_debit" ? "Submit Direct Debit setup request" :
          method === "invoice_link" ? "Confirm invoice billing" : "Choose a payment method"}
      </Button>
    </div>
  );
}
