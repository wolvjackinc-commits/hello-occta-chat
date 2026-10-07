import { contactError } from "@/lib/journey2/conversion";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AddressAutocomplete from "@/components/address/AddressAutocomplete";
import type { Journey2Session } from "@/lib/journey2/client";
import { getAvailabilityPrefill } from "@/lib/journey2/prefill";

export default function AddressStep({
  session, saving, onSave,
}: {
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const a = session.service_address;
  // Anything the customer already told us on the availability checker is reused
  // here so they never retype their postcode or chosen address.
  const [prefill] = useState(() => (a ? null : getAvailabilityPrefill()));
  const [postcode, setPostcode] = useState(a?.postcode ?? session.postcode ?? prefill?.postcode ?? "");
  const [line1, setLine1] = useState(a?.address_line_1 ?? prefill?.line1 ?? "");
  const [line2, setLine2] = useState(a?.address_line_2 ?? prefill?.line2 ?? "");
  const [town, setTown] = useState(a?.town ?? prefill?.town ?? "");
  const [county, setCounty] = useState(a?.county ?? prefill?.county ?? "");
  const d = session.customer_details;
  const [email, setEmail] = useState(d?.email ?? "");
  const [firstName, setFirstName] = useState(d?.full_name ?? "");
  const [manualEntry, setManualEntry] = useState(false);
  const [changeAddress, setChangeAddress] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showManualEntry = useCallback(() => {
    setChangeAddress(true);
    setManualEntry(true);
  }, []);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const validateContact = (field: string, value: string) => setFieldErrors((previous) => ({ ...previous, [field]: contactError(field, value) }));

  const hasUsableAddress = postcode.trim().length >= 5 && line1.trim().length >= 3 && town.trim().length >= 2;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasUsableAddress) {
      setManualEntry(true);
      setErr("Please find your address above or enter it manually.");
      return;
    }
    if (!firstName.trim() || firstName.trim().length < 2) {
      setErr("Please enter your full name.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setErr("Please enter a valid email address.");
      return;
    }
    setErr(null);
    onSave({
      postcode: postcode.trim().toUpperCase(),
      address_line_1: line1.trim(),
      address_line_2: line2.trim() || null,
      town: town.trim(),
      county: county.trim() || null,
      contact_email: email.trim().toLowerCase(),
      contact_full_name: firstName.trim(),
    });
  };

  const applyLookup = useCallback((addr: { line1: string; line2?: string; city: string; postcode: string }) => {
    setLine1(addr.line1);
    setLine2(addr.line2 ?? "");
    setTown(addr.city);
    setPostcode(addr.postcode.toUpperCase());
    setManualEntry(false);
    setChangeAddress(false);
    setErr(null);
  }, []);

  return (
    <form onSubmit={submit} className="space-y-4 border-4 border-foreground p-4 sm:p-6">
      <div>
        <h1 className="font-display uppercase text-2xl">Where is the service going?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find the installation address first. We'll confirm final network and supplier availability before provisioning.
        </p>
        {prefill && (prefill.postcode || prefill.line1) && (
          <p className="text-xs text-muted-foreground mt-2">
            We've reused what you entered in the address checker — change it only if it isn't right.
          </p>
        )}
      </div>

      {(!hasUsableAddress || changeAddress) && !manualEntry && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="j2-search-postcode">Installation postcode</Label>
            <Input
              id="j2-search-postcode"
              value={postcode}
              onChange={(e) => {
                setPostcode(e.target.value.toUpperCase());
                setLine1("");
                setTown("");
              }}
              autoComplete="postal-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={10}
              className="uppercase"
              aria-describedby="j2-postcode-help"
            />
            <p id="j2-postcode-help" className="mt-1 text-xs text-muted-foreground">
              Then choose your house number and street below.
            </p>
          </div>

          <AddressAutocomplete
            onSelect={applyLookup}
            onManualFallback={showManualEntry}
            expectedPostcode={postcode}
            label="Find your address"
            helperText="Start typing your house number and street, e.g. 22 Pavilion View."
          />

          <Button type="button" variant="outline" onClick={showManualEntry} className="w-full sm:w-auto">
            Can't find it? Enter address manually
          </Button>
        </div>
      )}

      {hasUsableAddress && !manualEntry && !changeAddress && (
        <div className="border-2 border-foreground bg-muted/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-wider text-muted-foreground">Selected address</p>
              <p className="mt-1 text-sm font-medium">
                {[line1, line2, town, county, postcode.toUpperCase()].filter(Boolean).join(", ")}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setChangeAddress(true)}>
              Change address
            </Button>
          </div>
        </div>
      )}

      {manualEntry && (
        <div className="space-y-3 border-2 border-foreground/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-sm uppercase">Enter address manually</p>
            {hasUsableAddress && (
              <button
                type="button"
                onClick={() => { setManualEntry(false); setChangeAddress(false); }}
                className="text-xs underline text-muted-foreground hover:text-foreground"
              >
                Done
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="j2-postcode">Postcode</Label>
              <Input id="j2-postcode" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                autoComplete="postal-code" required maxLength={10} className="uppercase" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="j2-line1">Address line 1</Label>
              <Input id="j2-line1" value={line1} onChange={(e) => setLine1(e.target.value)}
                autoComplete="address-line1" required maxLength={160} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="j2-line2">Address line 2 (optional)</Label>
              <Input id="j2-line2" value={line2 ?? ""} onChange={(e) => setLine2(e.target.value)}
                autoComplete="address-line2" maxLength={160} />
            </div>
            <div>
              <Label htmlFor="j2-town">Town or city</Label>
              <Input id="j2-town" value={town} onChange={(e) => setTown(e.target.value)}
                autoComplete="address-level2" required maxLength={80} />
            </div>
            <div>
              <Label htmlFor="j2-county">County (optional)</Label>
              <Input id="j2-county" value={county ?? ""} onChange={(e) => setCounty(e.target.value)}
                autoComplete="address-level1" maxLength={80} />
            </div>
          </div>
        </div>
      )}

      {hasUsableAddress && <div className="border-2 border-foreground/20 p-4 space-y-3">
        <p className="font-display uppercase text-sm">Where should we send your order updates?</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="j2-first-name">Full name</Label>
            <Input id="j2-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              autoComplete="name" required maxLength={120} onBlur={() => validateContact("name", firstName)} aria-invalid={!!fieldErrors.name} aria-describedby="j2-name-error" />
            <p id="j2-name-error" className="text-xs text-destructive" aria-live="polite">{fieldErrors.name}</p>
          </div>
          <div>
            <Label htmlFor="j2-early-email">Email address</Label>
            <Input id="j2-early-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required maxLength={180} placeholder="you@example.com" onBlur={() => validateContact("email", email)} aria-invalid={!!fieldErrors.email} aria-describedby="j2-early-email-error" />
            <p id="j2-early-email-error" className="text-xs text-destructive" aria-live="polite">{fieldErrors.email}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Used for your order and service updates. You can choose marketing preferences later.
        </p>
        <p className="text-xs text-muted-foreground">
          By continuing, you acknowledge OCCTA's <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link> and{" "}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>. Entering the order journey does not allow OCCTA to substitute a different broadband plan or price without your agreement.
        </p>
      </div>}

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : hasUsableAddress ? "Save address and compare plans" : "Continue with this address"}
      </Button>
    </form>
  );
}
