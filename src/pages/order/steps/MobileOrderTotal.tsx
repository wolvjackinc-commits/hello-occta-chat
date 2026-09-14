import { money, type Journey2Session } from "@/lib/journey2/client";
import { oneOffTotal } from "@/lib/journey2/conversion";

export default function MobileOrderTotal({ session }: { session: Journey2Session }) {
  const price = session.price_snapshot;
  if (!price) return null;
  return (
    <div className="mb-4 border-2 border-foreground bg-background p-3 lg:hidden">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <strong>{money(price.monthly_total_incl_vat)}/month</strong>
        <span>{money(oneOffTotal(price))} one-off</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Saved choices · includes VAT. Changes update after you continue.</p>
      <a href="#order-summary" className="mt-2 inline-flex min-h-11 items-center text-sm underline">View full cost breakdown</a>
    </div>
  );
}
