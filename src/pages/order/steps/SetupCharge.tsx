import { money } from "@/lib/journey2/client";

/** Small print shown wherever the free-activation offer appears. */
export const ADVANCED_INSTALL_NOTE = "Standard installation. If your property needs an advanced installation, that may be chargeable.";

/**
 * A one-off setup amount. While a limited offer waives it, the normal price is
 * shown crossed out so the customer sees the saving.
 */
export default function SetupCharge({ oneOff, wasOneOff }: { oneOff: number; wasOneOff?: number | null }) {
  if (wasOneOff && wasOneOff > oneOff) {
    return (
      <span className="whitespace-nowrap">
        <s className="text-muted-foreground" aria-label={`was ${money(wasOneOff)}`}>{money(wasOneOff)}</s>{" "}
        <strong className="bg-primary px-1 text-primary-foreground">{oneOff > 0 ? money(oneOff) : "FREE"}</strong>
      </span>
    );
  }
  return <span>{money(oneOff)}</span>;
}
