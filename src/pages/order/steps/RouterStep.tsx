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
    <div className="border-4 border-foreground p-6 space-y-5">
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
              className={`flex items-center justify-between gap-4 border-2 p-4 cursor-pointer ${selected ? "border-foreground bg-muted" : "border-border"}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="j2-router" checked={selected} onChange={() => setKey(r.key)} className="h-4 w-4" />
                <span>
                  <span className="block font-display uppercase">{optionLabel(r)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.option === "own"
                      ? "You'll need a compatible router. OCCTA support covers the service, but not third-party router hardware."
                      : r.payment_type === "monthly" ? "Added to your monthly bill while this router option applies." : "Paid once on your first bill."}
                  </span>
                </span>
              </span>
              <span className="text-right whitespace-nowrap">
                {r.monthly > 0 && <span className="block font-bold">{money(r.monthly)}<span className="text-xs font-normal">/mo</span></span>}
                {r.one_off > 0 && <span className="block font-bold">{money(r.one_off)} <span className="text-xs font-normal">one-off</span></span>}
                {r.monthly === 0 && r.one_off === 0 && <span className="block font-bold">No charge</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="button" disabled={saving || !chosen}
          onClick={() => chosen && onSave({ router_option: chosen.option, router_payment_type: chosen.payment_type })}>
          {saving ? "Saving…" : "Continue to extras"}
        </Button>
      </div>
    </div>
  );
}