import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money, type AddonId, type Catalogue, type Journey2Session } from "@/lib/journey2/client";

export default function ExtrasStep({
  catalogue, session, saving, onSave, onBack,
}: {
  catalogue: Catalogue;
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<AddonId[]>(session.selected_addons ?? []);
  const toggle = (id: AddonId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="border-4 border-foreground p-6 space-y-5">
      <div>
        <h1 className="font-display uppercase text-2xl">Extras</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Optional. Add nothing and your price stays exactly as shown in your summary.
        </p>
      </div>

      {catalogue.extras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No extras are available for this plan.</p>
      ) : (
        <fieldset className="space-y-3">
          <legend className="sr-only">Optional extras</legend>
          {catalogue.extras.map((e) => {
            const on = selected.includes(e.id);
            return (
              <label key={e.id}
                className={`flex items-center justify-between gap-4 border-2 p-4 cursor-pointer ${on ? "border-foreground bg-muted" : "border-border"}`}>
                <span className="flex items-center gap-3">
                  <input type="checkbox" checked={on} onChange={() => toggle(e.id)} className="h-4 w-4" />
                  <span className="font-display uppercase">{e.label}</span>
                </span>
                <span className="font-bold whitespace-nowrap">{money(e.monthly)}<span className="text-xs font-normal">/mo</span></span>
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="button" disabled={saving} onClick={() => onSave({ addons: selected })}>
          {saving ? "Saving…" : selected.length ? "Continue with extras" : "Continue without extras"}
        </Button>
      </div>
    </div>
  );
}