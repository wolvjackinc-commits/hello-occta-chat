import { useCallback, useState } from "react";
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
  const [firstName, setFirstName] = useState((d?.full_name ?? "").split(" ")[0] ?? "");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (postcode.trim().length < 5 || line1.trim().length < 3 || town.trim().length < 2) {
      setErr("Please enter your postcode, first address line and town.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setErr("That email doesn't look right — please check it.");
      return;
    }
    setErr(null);
    onSave({
      postcode: postcode.trim().toUpperCase(),
      address_line_1: line1.trim(),
      address_line_2: line2.trim() || null,
      town: town.trim(),
      county: county.trim() || null,
      contact_email: email.trim().toLowerCase() || null,
      contact_first_name: firstName.trim() || null,
    });
  };

  const applyLookup = useCallback((addr: { line1: string; line2?: string; city: string; postcode: string }) => {
    setLine1(addr.line1);
    setLine2(addr.line2 ?? "");
    setTown(addr.city);
    setPostcode(addr.postcode.toUpperCase());
    setErr(null);
  }, []);

  return (
    <form onSubmit={submit} className="border-4 border-foreground p-6 space-y-4">
      <div>
        <h1 className="font-display uppercase text-2xl">Where is the service going?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We need the address the broadband will be installed at. You can order in one go — no callbacks, no waiting for a quote.
        </p>
        {prefill && (prefill.postcode || prefill.line1) && (
          <p className="text-xs text-muted-foreground mt-2">
            We've filled this in from your availability check — please check it and change anything that isn't right.
          </p>
        )}
      </div>

      <AddressAutocomplete
        onSelect={applyLookup}
        initialQuery={postcode}
        label="Find your address"
        helperText="Pick your address and we'll fill the rest in — or type it below yourself."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <Label htmlFor="j2-postcode">Postcode</Label>
          <Input id="j2-postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)}
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

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <div className="border-2 border-foreground/20 p-4 space-y-3">
        <p className="font-display uppercase text-sm">Keep your order safe</p>
        <p className="text-xs text-muted-foreground">
          Give us your email now and we'll send you a link so you can come back to this exact order — same prices, nothing lost.
          No marketing unless you ask for it later.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="j2-first-name">First name (optional)</Label>
            <Input id="j2-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name" maxLength={80} />
          </div>
          <div>
            <Label htmlFor="j2-early-email">Email (optional)</Label>
            <Input id="j2-early-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" maxLength={180} placeholder="you@example.com" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Continue to plans"}
      </Button>
    </form>
  );
}