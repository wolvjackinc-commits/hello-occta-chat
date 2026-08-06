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
  const current = session.router_option
    ? `${session.router_option.router_option}_${session.router_option.router_payment_type}`
    : catalogue.routers[0]?.key ?? "own_none";
  const [key, setKey] = useState(current);
  const chosen = catalogue.routers.find((r) => r.key === key) ?? catalogue.routers[0];

  return (
    <div className="border-4 border-foreground p-6 space-y-5">
      <div>
        <h1 className="font-display uppercase text-2xl">Router</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bring your own or take one of ours. Monthly router charges are included in your monthly total; one-off charges appear in your first bill.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">Router option</legend>
        {catalogue.routers.map((r) => {
          const selected = r.key === key;
          return (
            <label key={r.key}
              className={`flex items-center justify-between gap-4 border-2 p-4 cursor-pointer ${selected ? "border-foreground bg-muted" : "border-border"}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="j2-router" checked={selected} onChange={() => setKey(r.key)} className="h-4 w-4" />
                <span>
                  <span className="block font-display uppercase">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.option === "own"
                      ? "You'll need a router that supports our service. We can't provide support for third-party hardware."
                      : r.payment_type === "monthly" ? "Spread over your monthly bill." : "Paid once, on your first bill."}
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