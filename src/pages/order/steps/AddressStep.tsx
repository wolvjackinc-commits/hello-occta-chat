import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (postcode.trim().length < 5 || line1.trim().length < 3 || town.trim().length < 2) {
      setErr("Please enter your postcode, first address line and town.");
      return;
    }
    setErr(null);
    onSave({
      postcode: postcode.trim().toUpperCase(),
      address_line_1: line1.trim(),
      address_line_2: line2.trim() || null,
      town: town.trim(),
      county: county.trim() || null,
    });
  };

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

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Continue to plans"}
      </Button>
    </form>
  );
}