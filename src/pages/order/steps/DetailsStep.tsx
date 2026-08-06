import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Journey2Session } from "@/lib/journey2/client";

export default function DetailsStep({
  session, saving, onSave, onBack,
}: {
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const d = session.customer_details;
  const [fullName, setFullName] = useState(d?.full_name ?? "");
  const [email, setEmail] = useState(d?.email ?? "");
  const [phone, setPhone] = useState(d?.phone ?? "");
  const [dob, setDob] = useState(d?.date_of_birth ?? "");
  const [provider, setProvider] = useState(d?.current_provider ?? "");
  const [marketing, setMarketing] = useState(!!d?.marketing_consent);
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || phone.replace(/\D/g, "").length < 10) {
      setErr("Please check your name, email address and phone number.");
      return;
    }
    setErr(null);
    onSave({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      date_of_birth: dob || null,
      current_provider: provider.trim() || null,
      marketing_consent: marketing,
    });
  };

  return (
    <form onSubmit={submit} className="border-4 border-foreground p-6 space-y-4">
      <div>
        <h1 className="font-display uppercase text-2xl">Your details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We use these to prepare your contract and keep you updated. Next you'll read your contract before anything is agreed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="j2-name">Full name</Label>
          <Input id="j2-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required maxLength={120} />
        </div>
        <div>
          <Label htmlFor="j2-email">Email address</Label>
          <Input id="j2-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={180} />
        </div>
        <div>
          <Label htmlFor="j2-phone">Mobile or phone number</Label>
          <Input id="j2-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required maxLength={30} />
        </div>
        <div>
          <Label htmlFor="j2-dob">Date of birth (optional)</Label>
          <Input id="j2-dob" type="date" value={dob ?? ""} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="j2-provider">Current provider (optional)</Label>
          <Input id="j2-provider" value={provider ?? ""} onChange={(e) => setProvider(e.target.value)} maxLength={80} />
        </div>
      </div>

      <div className="flex items-start gap-3 border-2 border-border p-4">
        <Checkbox id="j2-marketing" checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
        <Label htmlFor="j2-marketing" className="text-sm font-normal leading-relaxed">
          Email me occasional OCCTA offers and service news. Optional — your order works either way, and you can opt out at any time.
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        We handle your details as described in our{" "}
        <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Continue to your contract"}</Button>
      </div>
    </form>
  );
}