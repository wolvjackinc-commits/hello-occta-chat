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
  const [voiceAck, setVoiceAck] = useState(!!session.digital_voice_acknowledged);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: AddonId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const hasVoice = selected.includes("digital_voice");

  const submit = () => {
    if (hasVoice && !voiceAck) {
      setErr("Please confirm you've read how Digital Voice and emergency calls work.");
      return;
    }
    setErr(null);
    onSave({ addons: selected, digital_voice_acknowledged: hasVoice ? true : undefined });
  };

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

      {hasVoice && (
        <div className="border-2 border-foreground p-4 space-y-3">
          <h2 className="font-display uppercase text-sm tracking-widest">Digital Voice — please read</h2>
          <p className="text-sm text-muted-foreground">
            Digital Voice calls, including 999, work over your broadband. They will not work during a power cut or a
            broadband outage unless you have a backup, and your location isn't sent automatically in the same way as a
            traditional landline. Tell us at the next step if anyone at your address relies on the phone for care or a
            medical alarm.
          </p>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" checked={voiceAck} onChange={(e) => setVoiceAck(e.target.checked)} className="mt-1 h-4 w-4" />
            I've read and understood how Digital Voice and emergency calls work.
          </label>
        </div>
      )}

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : selected.length ? "Continue with extras" : "Continue without extras"}
        </Button>
      </div>
    </div>
  );
}