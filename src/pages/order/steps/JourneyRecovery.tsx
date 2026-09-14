import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function JourneyRecovery({ expiresAt }: { expiresAt: string }) {
  const [message, setMessage] = useState("");
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
  return (
    <details className="mt-4 border-2 border-border p-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">Need to finish later?</summary>
      <p className="mb-3 text-muted-foreground">Completed steps are saved when you continue. Return using this private link
        {Number.isNaN(expiry.getTime()) ? "." : ` before ${expiry.toLocaleDateString("en-GB")}.`} Entries on the current step are saved only when you continue.</p>
      <Button type="button" variant="outline" onClick={copy}>Copy my private order link</Button>
      <p role="status" className="mt-2 text-xs">{message}</p>
    </details>
  );
}
