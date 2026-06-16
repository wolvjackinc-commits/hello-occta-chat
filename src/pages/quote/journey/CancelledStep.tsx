import { ShieldOff } from "lucide-react";

function formatLondon(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch { return d; }
}

export default function CancelledStep({
  cancelledAt,
  reasonCode,
  orderNumber,
}: {
  cancelledAt: string | null;
  reasonCode: string | null;
  orderNumber: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="border-4 border-foreground bg-muted/40 p-6 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 border-4 border-foreground bg-background">
          <ShieldOff className="w-7 h-7" />
        </div>
        <p className="font-display uppercase text-xl">Order cancelled</p>
        {orderNumber ? (
          <p className="text-sm">Reference: <strong>{orderNumber}</strong></p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          We've recorded your cancellation on <strong>{formatLondon(cancelledAt)}</strong> (UK time)
          {reasonCode ? <> · reason: <em>{reasonCode.replace(/_/g, " ")}</em></> : null}.
        </p>
        <p className="text-sm text-muted-foreground">
          OCCTA will only contact you if anything further is needed. No payment was taken and no service has been activated.
        </p>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        Questions? <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a>
      </div>
    </div>
  );
}
