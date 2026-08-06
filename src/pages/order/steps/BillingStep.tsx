import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DD_GUARANTEE_TEXT } from "@/lib/legal/directDebitGuarantee";
import { money, type Journey2Session } from "@/lib/journey2/client";

const DAYS = [1, 5, 10, 15, 20, 25, 28];

/**
 * Journey 2 — billing day and Direct Debit Instruction, captured before the
 * contract is generated. Card payment is deliberately not offered.
 */
export default function BillingStep({
  session, saving, onSave, onBack,
}: {
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const addr = session.service_address;
  const [day, setDay] = useState(String(session.billing_anchor_day ?? 1));
  const [holder, setHolder] = useState(session.dd_masked?.account_holder_name ?? session.customer_details?.full_name ?? "");
  const [sort, setSort] = useState("");
  const [account, setAccount] = useState("");
  const [bank, setBank] = useState(session.dd_masked?.bank_name ?? "");
  const [billingAddress, setBillingAddress] = useState(
    addr ? [addr.address_line_1, addr.address_line_2, addr.town, addr.county].filter(Boolean).join(", ") : "",
  );
  const [postcode, setPostcode] = useState(addr?.postcode ?? session.postcode ?? "");
  const [ukAccount, setUkAccount] = useState(false);
  const [authorised, setAuthorised] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const digitsOnly = (v: string) => v.replace(/\D/g, "");
  const alreadyStored = !!session.dd_masked;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = digitsOnly(sort), a = digitsOnly(account);
    if (holder.trim().length < 2) return setErr("Please enter the account holder's name.");
    if (s.length !== 6) return setErr("Sort code must be 6 digits.");
    if (a.length !== 8) return setErr("Account number must be 8 digits.");
    if (bank.trim().length < 2) return setErr("Please enter your bank name.");
    if (billingAddress.trim().length < 3 || postcode.trim().length < 3) return setErr("Please enter your billing address and postcode.");
    if (!ukAccount || !authorised || !consent) return setErr("Please tick all three confirmations to set up your Direct Debit.");
    setErr(null);
    onSave({
      billing_anchor_day: Number(day),
      dd_consent: true,
      dd_details: {
        account_holder_name: holder.trim(),
        sort_code: s,
        account_number: a,
        bank_name: bank.trim(),
        billing_address: billingAddress.trim(),
        postcode: postcode.trim().toUpperCase(),
        uk_account_confirmed: true,
        payer_authorised_confirmed: true,
      },
    });
  };

  return (
    <form onSubmit={submit} className="border-4 border-foreground p-6 space-y-5">
      <div>
        <h1 className="font-display uppercase text-2xl">Billing and Direct Debit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Nothing is taken today — <strong>{money(0)}</strong> due now. Your details are stored securely and your first
          collection only happens after your Direct Debit is active and we've given you advance notice.
        </p>
      </div>

      <div className="max-w-xs">
        <Label htmlFor="j2-billing-day">Preferred billing day each month</Label>
        <Select value={day} onValueChange={setDay}>
          <SelectTrigger id="j2-billing-day"><SelectValue placeholder="Choose a day" /></SelectTrigger>
          <SelectContent>
            {DAYS.map((d) => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {alreadyStored && (
        <p className="border-2 border-border p-3 text-sm">
          We already hold an instruction for {session.dd_masked?.bank_name} ending{" "}
          <strong>••••{session.dd_masked?.last4}</strong>. Re-entering your details below replaces it.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="j2-dd-holder">Account holder name</Label>
          <Input id="j2-dd-holder" value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="name" maxLength={100} required />
        </div>
        <div>
          <Label htmlFor="j2-dd-sort">Sort code</Label>
          <Input id="j2-dd-sort" inputMode="numeric" value={sort} onChange={(e) => setSort(e.target.value)} placeholder="000000" maxLength={8} required />
        </div>
        <div>
          <Label htmlFor="j2-dd-acct">Account number</Label>
          <Input id="j2-dd-acct" inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="00000000" maxLength={10} required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="j2-dd-bank">Bank name</Label>
          <Input id="j2-dd-bank" value={bank} onChange={(e) => setBank(e.target.value)} maxLength={100} required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="j2-dd-addr">Billing address</Label>
          <Input id="j2-dd-addr" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} maxLength={400} required />
        </div>
        <div>
          <Label htmlFor="j2-dd-pc">Billing postcode</Label>
          <Input id="j2-dd-pc" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} maxLength={12} required />
        </div>
      </div>

      <fieldset className="space-y-3 border-2 border-border p-4">
        <legend className="font-display uppercase text-xs tracking-widest px-1">Your confirmations</legend>
        <div className="flex items-start gap-3">
          <Checkbox id="j2-dd-uk" checked={ukAccount} onCheckedChange={(v) => setUkAccount(v === true)} className="mt-0.5" />
          <Label htmlFor="j2-dd-uk" className="text-sm font-normal leading-relaxed">
            This is a UK bank or building society account that accepts Direct Debits.
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="j2-dd-auth" checked={authorised} onCheckedChange={(v) => setAuthorised(v === true)} className="mt-0.5" />
          <Label htmlFor="j2-dd-auth" className="text-sm font-normal leading-relaxed">
            I am the account holder and the only person required to authorise Direct Debits on this account.
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="j2-dd-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
          <Label htmlFor="j2-dd-consent" className="text-sm font-normal leading-relaxed">
            I instruct OCCTA LIMITED to collect amounts due under my service agreement by Direct Debit, subject to the
            Direct Debit Guarantee below.
          </Label>
        </div>
      </fieldset>

      <section className="border-2 border-foreground p-4">
        <h2 className="font-display uppercase text-sm tracking-widest mb-2">The Direct Debit Guarantee</h2>
        <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-5">
          {DD_GUARANTEE_TEXT.split("\n\n").map((p) => <li key={p.slice(0, 24)}>{p}</li>)}
        </ul>
      </section>

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving securely…" : "Continue to your contract"}</Button>
      </div>
    </form>
  );
}
