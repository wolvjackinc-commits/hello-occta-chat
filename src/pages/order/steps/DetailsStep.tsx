import { getStoredCampaignCode, normaliseReferenceCode } from "@/lib/campaignAttribution";
import { contactError } from "@/lib/journey2/conversion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Journey2Session } from "@/lib/journey2/client";

function ageFrom(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const b = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/**
 * Journey 2 — customer details. Required facts stay server-validated, while
 * optional/current-provider/support questions are visually tucked away so the
 * normal checkout is short and easy to scan.
 */
export default function DetailsStep({
  session, saving, onSave, onBack,
}: {
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const d = session.customer_details;
  const voiceSelected = (session.selected_addons ?? []).includes("digital_voice");
  const [fullName, setFullName] = useState(d?.full_name ?? "");
  const [email, setEmail] = useState(d?.email ?? "");
  const [phone, setPhone] = useState(d?.phone ?? "");
  const [dob, setDob] = useState(d?.date_of_birth ?? "");
  const [billingSame, setBillingSame] = useState(d?.billing_address_same !== false);
  const [bLine1, setBLine1] = useState(d?.billing_address?.address_line_1 ?? "");
  const [bLine2, setBLine2] = useState(d?.billing_address?.address_line_2 ?? "");
  const [bTown, setBTown] = useState(d?.billing_address?.town ?? "");
  const [bPostcode, setBPostcode] = useState(d?.billing_address?.postcode ?? "");
  const [provider, setProvider] = useState(d?.current_provider ?? "");
  const [contractStatus, setContractStatus] = useState(d?.current_contract_status ?? "unknown");
  const [contractEnd, setContractEnd] = useState(d?.current_contract_end_date ?? "");
  const [numberAction, setNumberAction] = useState(d?.number_action ?? "none");
  const [numberToPort, setNumberToPort] = useState(d?.number_to_port ?? "");
  const [access, setAccess] = useState(d?.accessibility_needs ?? "");
  const [vulnerability, setVulnerability] = useState(d?.vulnerability_support_needs ?? "");
  const [marketing, setMarketing] = useState(!!d?.marketing_consent);
  const [offerCode, setOfferCode] = useState(d?.offer_code ?? getStoredCampaignCode() ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || phone.replace(/\D/g, "").length < 10) {
      return setErr("Please check your name, email address and phone number.");
    }
    const age = ageFrom(dob);
    if (age === null) return setErr("Please enter your date of birth.");
    if (age < 18) return setErr("You must be 18 or over to take out this service.");
    if (age > 120) return setErr("Please enter a valid date of birth.");
    if (!billingSame && (bLine1.trim().length < 2 || bTown.trim().length < 2 || bPostcode.trim().length < 3)) {
      return setErr("Please complete your billing address.");
    }
    if (contractStatus === "in_contract" && !contractEnd) {
      return setErr("Please tell us when your current contract ends, or choose a different option.");
    }
    if (voiceSelected && numberAction === "port_in" && numberToPort.replace(/\D/g, "").length < 10) {
      return setErr("Please enter the number you'd like to bring with you.");
    }
    const typedOffer = offerCode.trim();
    if (typedOffer && !normaliseReferenceCode(typedOffer)) {
      return setErr("Offer or reference codes use 3–24 letters, numbers or hyphens.");
    }
    setErr(null);
    onSave({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      date_of_birth: dob,
      // Derived from the server-validated DOB instead of asking for a redundant tick.
      age_18_confirmed: true,
      billing_address_same: billingSame,
      billing_address: billingSame ? null : {
        address_line_1: bLine1.trim(),
        address_line_2: bLine2.trim() || null,
        town: bTown.trim(),
        postcode: bPostcode.trim().toUpperCase(),
      },
      current_provider: provider.trim() || null,
      current_contract_status: contractStatus,
      current_contract_end_date: contractStatus === "in_contract" ? contractEnd : null,
      number_action: voiceSelected ? numberAction : "none",
      number_to_port: voiceSelected && numberAction === "port_in" ? numberToPort.trim() : null,
      accessibility_needs: access.trim() || null,
      vulnerability_support_needs: vulnerability.trim() || null,
      marketing_consent: marketing,
      offer_code: normaliseReferenceCode(typedOffer),
      // The privacy notice is presented directly beside the continue action.
      privacy_acknowledged: true,
    });
  };

  return (
    <form onSubmit={submit} className="border-4 border-foreground p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="font-display uppercase text-2xl">Your details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Just the information we need to prepare your agreement and service.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="j2-name">Full name</Label>
          <Input id="j2-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required maxLength={120} readOnly className="bg-muted" />
          <p className="text-[10px] text-muted-foreground mt-1">Locked to this order session.</p>
        </div>
        <div>
          <Label htmlFor="j2-email">Email address</Label>
          <Input id="j2-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={180} readOnly className="bg-muted" />
        </div>
        <div>
          <Label htmlFor="j2-phone">Mobile or phone number</Label>
          <Input id="j2-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" required maxLength={30} onBlur={() => setPhoneError(contactError("phone", phone))} aria-invalid={!!phoneError} aria-describedby="j2-phone-error" />
          <p id="j2-phone-error" className="text-xs text-destructive" aria-live="polite">{phoneError}</p>
        </div>
        <div>
          <Label htmlFor="j2-dob">Date of birth</Label>
          <Input id="j2-dob" type="date" value={dob ?? ""} onChange={(e) => setDob(e.target.value)} required />
          <p className="mt-1 text-[10px] text-muted-foreground">Used to confirm you are 18 or over. No extra checkbox needed.</p>
        </div>
      </div>

      <div className="border-2 border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display uppercase text-xs tracking-widest">Billing address</p>
            <p className="text-xs text-muted-foreground">
              {billingSame ? "Same as your service address." : "Using a different billing address."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setBillingSame((v) => !v)}>
            {billingSame ? "Use a different address" : "Use service address"}
          </Button>
        </div>
        {!billingSame && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="j2-b1">Address line 1</Label>
              <Input id="j2-b1" value={bLine1} onChange={(e) => setBLine1(e.target.value)} maxLength={120} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="j2-b2">Address line 2 (optional)</Label>
              <Input id="j2-b2" value={bLine2 ?? ""} onChange={(e) => setBLine2(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="j2-btown">Town or city</Label>
              <Input id="j2-btown" value={bTown} onChange={(e) => setBTown(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="j2-bpc">Postcode</Label>
              <Input id="j2-bpc" value={bPostcode} onChange={(e) => setBPostcode(e.target.value.toUpperCase())} maxLength={12} />
            </div>
          </div>
        )}
      </div>

      <details className="border-2 border-border p-4">
        <summary className="cursor-pointer font-display uppercase text-xs tracking-widest">
          Current provider & switching details <span className="font-sans normal-case tracking-normal text-muted-foreground">(optional)</span>
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="j2-provider">Current provider</Label>
            <Input id="j2-provider" value={provider ?? ""} onChange={(e) => setProvider(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label htmlFor="j2-cstatus">Contract status</Label>
            <Select value={contractStatus} onValueChange={(v) => setContractStatus(v as typeof contractStatus)}>
              <SelectTrigger id="j2-cstatus"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="out_of_contract">Out of contract</SelectItem>
                <SelectItem value="in_contract">Still in contract</SelectItem>
                <SelectItem value="new_line">Brand new line</SelectItem>
                <SelectItem value="unknown">Not sure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {contractStatus === "in_contract" && (
            <div>
              <Label htmlFor="j2-cend">Current contract end date</Label>
              <Input id="j2-cend" type="date" value={contractEnd ?? ""} onChange={(e) => setContractEnd(e.target.value)} />
            </div>
          )}
          {voiceSelected && (
            <>
              <div>
                <Label htmlFor="j2-number">Phone number</Label>
                <Select value={numberAction} onValueChange={(v) => setNumberAction(v as typeof numberAction)}>
                  <SelectTrigger id="j2-number"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">I don't need a phone number</SelectItem>
                    <SelectItem value="keep_existing">Keep my existing number</SelectItem>
                    <SelectItem value="port_in">Bring my number to OCCTA</SelectItem>
                    <SelectItem value="new_number">Give me a new number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {numberAction === "port_in" && (
                <div>
                  <Label htmlFor="j2-port">Number to bring with you</Label>
                  <Input id="j2-port" type="tel" value={numberToPort ?? ""} onChange={(e) => setNumberToPort(e.target.value)} maxLength={30} />
                </div>
              )}
            </>
          )}
        </div>
      </details>

      <details className="border-2 border-border p-4">
        <summary className="cursor-pointer font-display uppercase text-xs tracking-widest">
          Accessibility or extra support <span className="font-sans normal-case tracking-normal text-muted-foreground">(optional)</span>
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="j2-access">Accessibility needs</Label>
            <Textarea id="j2-access" value={access ?? ""} onChange={(e) => setAccess(e.target.value)} maxLength={600} rows={2} />
          </div>
          <div>
            <Label htmlFor="j2-vuln">Anything that means you'd need extra support</Label>
            <Textarea id="j2-vuln" value={vulnerability ?? ""} onChange={(e) => setVulnerability(e.target.value)} maxLength={600} rows={2} />
          </div>
        </div>
      </details>

      <div>
        <Label htmlFor="j2-offer">Offer or reference code <span className="font-sans normal-case tracking-normal text-muted-foreground">(optional)</span></Label>
        <Input
          id="j2-offer"
          value={offerCode}
          onChange={(e) => setOfferCode(e.target.value.toUpperCase())}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          placeholder="For example LOCK-A"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">If your flyer or QR code included a reference, it is filled in here. You can change it or leave it blank.</p>
      </div>

      <div className="flex items-start gap-3 border-2 border-border p-4">
        <Checkbox id="j2-marketing" checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
        <Label htmlFor="j2-marketing" className="text-sm font-normal leading-relaxed">
          Email me occasional OCCTA offers and service news. Optional — your order works either way.
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        By continuing, you acknowledge that OCCTA will use the information you provided to process this order and provide the service as explained in our{" "}
        <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Continue"}</Button>
      </div>
    </form>
  );
}
