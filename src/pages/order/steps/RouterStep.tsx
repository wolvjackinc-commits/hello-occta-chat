import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { money, type Catalogue, type Journey2Session } from "@/lib/journey2/client";
import type { OrderSelection } from "@/lib/journey2/selection";

export default function RouterStep({
  catalogue, session, saving, onSave, onBack, onSelectionChange,
}: {
  catalogue: Catalogue;
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
  /** Reports the unsaved choice so the order summary can price it live. */
  onSelectionChange?: (selection: OrderSelection) => void;
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

  useEffect(() => {
    if (chosen) onSelectionChange?.({ router: { option: chosen.option, payment_type: chosen.payment_type } });
  }, [chosen?.option, chosen?.payment_type, onSelectionChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = (r: (typeof availableRouters)[number]) => {
    if (r.option === "own") return { title: "Use my own router", price: "Free", note: "Keep the compatible router you already have. Nothing extra to pay." };
    if (r.payment_type === "monthly") return { title: "OCCTA WiFi 6 router", price: `${money(r.monthly)}/month`, note: "Sent to you ready to plug in. Added to your monthly bill." };
    if (r.payment_type === "one_off") return { title: "Buy the OCCTA WiFi 6 router", price: `${money(r.one_off)} once`, note: "Pay once on your first bill." };
    return { title: r.label, price: r.monthly > 0 ? `${money(r.monthly)}/month` : `${money(r.one_off)} once`, note: "" };
  };

  return (
    <div className="space-y-5 border-4 border-foreground p-4 sm:p-6">
      <div>
        <h1 className="font-display uppercase text-2xl">Do you need a router?</h1>
        <p className="text-sm text-muted-foreground mt-1">Most people keep the router they already have.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">Router option</legend>
        {availableRouters.map((r) => {
          const selected = r.key === selectedKey;
          const c = copy(r);
          return (
            <label key={r.key}
              className={`flex cursor-pointer items-center justify-between gap-4 border-2 p-4 ${selected ? "border-foreground bg-muted" : "border-border"}`}>
              <span className="flex min-w-0 items-start gap-3">
                <input type="radio" name="j2-router" checked={selected} onChange={() => setKey(r.key)} className="mt-1 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-display uppercase">{c.title}</span>
                  {c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}
                </span>
              </span>
              <span className="whitespace-nowrap text-right font-bold">{c.price}</span>
            </label>
          );
        })}
      </fieldset>
      {session.plan_term === "flex_30" && availableRouters.some((r) => r.option === "standard") && (
        <p className="text-xs text-muted-foreground">On Flex 30 the OCCTA router is a one-off purchase, as there's no long contract to spread it over.</p>
      )}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto">Back</Button>
        <Button type="button" disabled={saving || !chosen}
          onClick={() => chosen && onSave({ router_option: chosen.option, router_payment_type: chosen.payment_type })}
          className="w-full sm:w-auto">
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
