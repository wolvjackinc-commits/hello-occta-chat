import { money, type Catalogue, type Journey2Session } from "@/lib/journey2/client";
import { oneOffTotal } from "@/lib/journey2/conversion";
import { selectionDiffers, selectionTotals, type OrderSelection } from "@/lib/journey2/selection";

export default function MobileOrderTotal({
  session,
  catalogue = null,
  selection = null,
}: {
  session: Journey2Session;
  catalogue?: Catalogue | null;
  selection?: OrderSelection | null;
}) {
  const price = session.price_snapshot;
  const live = selectionTotals(catalogue, session, selection);
  const showLive = selectionDiffers(live, price, price ? oneOffTotal(price) : 0);
  if (!price && !live) return null;
  const monthly = showLive && live ? live.monthly : price!.monthly_total_incl_vat;
  const oneOff = showLive && live ? live.oneOff : oneOffTotal(price!);
  return (
    <div className="mb-4 border-2 border-foreground bg-background p-3 lg:hidden" aria-live="polite">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <strong>{money(monthly)}/month</strong>
        <span>{money(oneOff)} one-off</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {showLive ? "Your current selection · includes VAT. Confirmed when you continue." : "Saved choices · includes VAT."}
      </p>
      <a href="#order-summary" className="mt-2 inline-flex min-h-11 items-center text-sm underline">View full cost breakdown</a>
    </div>
  );
}
