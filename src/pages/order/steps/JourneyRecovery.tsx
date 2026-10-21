import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { journey2 } from "@/lib/journey2/client";

export default function JourneyRecovery({
  expiresAt,
  token = null,
  canSaveEmail = false,
  onEmailSaved,
}: {
  expiresAt: string;
  token?: string | null;
  /** Offer "email me a link back" (server supports it and we don't hold an email yet). */
  canSaveEmail?: boolean;
  onEmailSaved?: (email: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const expiry = new Date(expiresAt);

  const copy = async () => {
    try {
      // Copy only on request; never send the private order link to analytics.
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setMessage("Order link copied. Keep it private — it gives access to your order.");
    } catch {
      setMessage("Copy this page's address from your browser to return to your order. Keep it private.");
    }
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setEmailMessage("Please enter a valid email address.");
      return;
    }
    if (!token) return;
    setSaving(true);
    try {
      const res = await journey2.saveContact(token, value);
      if (!res?.ok) throw new Error(res?.error ?? "save_failed");
      onEmailSaved?.(value);
      setEmailMessage(
        res.resume_emails
          ? "Saved. If you don't finish, we'll email you a private link back to your order."
          : "Saved. We'll use this email for your order updates.",
      );
    } catch {
      setEmailMessage("We couldn't save that just now. You can still copy your private link below.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mt-4 border-2 border-border p-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">
        {canSaveEmail ? "Need to finish later? Save your order to your email" : "Need to finish later?"}
      </summary>
      {canSaveEmail && !emailMessage?.startsWith("Saved") && (
        <form onSubmit={saveEmail} className="mb-4 space-y-2">
          <label htmlFor="j2-recovery-email" className="block text-muted-foreground">
            Pop in your email and we'll keep your order safe. Optional — nothing else is needed yet.
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="j2-recovery-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={180}
            />
            <Button type="submit" disabled={saving} className="sm:w-auto">{saving ? "Saving…" : "Save my order"}</Button>
          </div>
        </form>
      )}
      {emailMessage && <p role="status" className="mb-3 text-xs">{emailMessage}</p>}
      <p className="mb-3 text-muted-foreground">Completed steps are saved when you continue. Return using this private link
        {Number.isNaN(expiry.getTime()) ? "." : ` before ${expiry.toLocaleDateString("en-GB")}.`} Entries on the current step are saved only when you continue.</p>
      <Button type="button" variant="outline" onClick={copy}>Copy my private order link</Button>
      <p role="status" className="mt-2 text-xs">{message}</p>
    </details>
  );
}
