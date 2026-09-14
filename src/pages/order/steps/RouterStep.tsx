import { oneOffTotal } from "@/lib/journey2/conversion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money, type Catalogue, type Journey2Session } from "@/lib/journey2/client";

export default function RouterStep({
  catalogue, session, saving, onSave, onBack,
}: {
  catalogue: Catalogue;
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  // Flex 30 must not offer the monthly Standard WiFi 6 option: the pricing
  // engine intentionally blocks that combination so there is no long equipment
  // commitment attached to a rolling broadband service.
  const availableRouters = catalogue.routers.filter((r) =>
    !(session.plan_term === "flex_30" && r.option === "standard" && r.payment_type === "monthly"),
  );
  const current = session.router_option
    ? `${session.router_option.router_option}_${session.router_option.router_payment_type}`
    : availableRouters[0]?.key ?? "own_none";
  const [key, setKey] = useState(current);
  const selectedKey = availableRouters.some((r) => r.key === key) ? key : availableRouters[0]?.key;
  const chosen = availableRouters.find((r) => r.key === selectedKey) ?? availableRouters[0];

  const optionLabel = (r: (typeof availableRouters)[number]) => {
    if (r.option === "own") return "Bring your own router";
    if (r.option === "standard" && r.payment_type === "monthly") return "Standard WiFi 6 router — monthly";
    if (r.option === "standard" && r.payment_type === "one_off") return "Standard WiFi 6 router — one-off";
    return `${r.label}${r.payment_type === "monthly" ? " — monthly" : r.payment_type === "one_off" ? " — one-off" : ""}`;
  };

  return (
    <div className="space-y-5 border-4 border-foreground p-4 sm:p-6">
      <div>
        <h1 className="font-display uppercase text-2xl">Router</h1>
        <p className="text-sm text-muted-foreground mt-1">
          No plan includes a router. Bring your own, or choose an OCCTA Standard WiFi 6 router.
          Monthly router charges are added to your monthly total; one-off charges appear on your first bill.
        </p>
        {session.plan_term === "flex_30" && (
          <p className="text-xs border-2 border-foreground p-3 mt-3">
            Flex 30 has no long equipment commitment, so the Standard WiFi 6 router is available as a one-off purchase rather than a monthly router charge.
          </p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">Router option</legend>
        {availableRouters.map((r) => {
          const selected = r.key === selectedKey;
          return (
            <label key={r.key}
              className={`flex cursor-pointer flex-col items-stretch gap-3 border-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${selected ? "border-foreground bg-muted" : "border-border"}`}>
              <span className="flex min-w-0 items-start gap-3">
                <input type="radio" name="j2-router" checked={selected} onChange={() => setKey(r.key)} className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-display uppercase">{optionLabel(r)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.option === "own"
                      ? "You'll need a compatible router. OCCTA support covers the service, but not third-party router hardware."
                      : r.payment_type === "monthly" ? "Added to your monthly bill while this router option applies." : "Paid once on your first bill."}
                  </span>
                </span>
              </span>
              <span className="whitespace-nowrap pl-7 text-left sm:pl-0 sm:text-right">
                {r.monthly > 0 && <span className="block font-bold">{money(r.monthly)}<span className="text-xs font-normal">/mo</span></span>}
                {r.one_off > 0 && <span className="block font-bold">{money(r.one_off)} <span className="text-xs font-normal">one-off</span></span>}
                {r.monthly === 0 && r.one_off === 0 && <span className="block font-bold">No charge</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      {chosen && session.price_snapshot && (
        <div className="border-2 border-foreground p-3 text-sm" aria-live="polite">
          <p className="font-semibold">With this router: {money(session.price_snapshot.monthly_total_incl_vat - (session.price_snapshot.router?.monthly ?? 0) + chosen.monthly)}/month</p>
          <p>{money(oneOffTotal(session.price_snapshot) - (session.price_snapshot.router?.oneOff ?? 0) + chosen.one_off)} one-off in total · includes VAT</p>
          <p className="mt-1 text-xs text-muted-foreground">Includes your saved plan and extras. Confirmed when you continue.</p>
        </div>
      )}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto">Back</Button>
        <Button type="button" disabled={saving || !chosen}
          onClick={() => chosen && onSave({ router_option: chosen.option, router_payment_type: chosen.payment_type })}
          className="w-full sm:w-auto">
          {saving ? "Saving…" : "Continue to extras"}
        </Button>
      </div>
    </div>
  );
}