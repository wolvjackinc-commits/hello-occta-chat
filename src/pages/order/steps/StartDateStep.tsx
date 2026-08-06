import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Journey2Session } from "@/lib/journey2/client";

/** Statutory cooling-off window mirrored by the server. */
const COOLING_OFF_DAYS = 14;
/**
 * The shared journey allows a start date only AFTER the cooling-off period ends
 * (end of day 14), so the first selectable day is day 15. Journey 2 must offer
 * exactly the same window or the date is rejected once the contract is signed.
 */
const EARLIEST_START_OFFSET_DAYS = COOLING_OFF_DAYS + 1;

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function pretty(date: string) {
  try {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
    });
  } catch { return date; }
}

/**
 * Journey 2 — preferred start date, captured BEFORE the contract is generated
 * so the contract documents can state the date the customer actually chose.
 */
export default function StartDateStep({
  session, saving, onSave, onBack,
}: {
  session: Journey2Session;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const earliest = ymd(addDays(today, EARLIEST_START_OFFSET_DAYS));
  const latest = ymd(addDays(today, 90));
  const [date, setDate] = useState(session.preferred_start_date ?? earliest);
  const [ack, setAck] = useState(!!session.cooling_off_acknowledged);
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || date < earliest) {
      setErr(`The earliest date we can start is ${pretty(earliest)}, because of your 14-day cancellation period.`);
      return;
    }
    if (date > latest) { setErr("Please choose a date within the next 90 days."); return; }
    if (!ack) { setErr("Please confirm you understand this is a preferred date."); return; }
    setErr(null);
    onSave({ preferred_start_date: date, cooling_off_acknowledged: true });
  };

  return (
    <form onSubmit={submit} className="border-4 border-foreground p-6 space-y-4">
      <div>
        <h1 className="font-display uppercase text-2xl">Preferred start date</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose when you'd like your service to start. Your contract will show this date.
        </p>
      </div>

      <div className="border-2 border-border p-4 text-sm space-y-2">
        <p>
          You get a <strong>14-day cancellation period</strong> from the day you accept your agreement, so the earliest
          start date is <strong>{pretty(earliest)}</strong>.
        </p>
        <p className="text-muted-foreground">
          Nothing is taken today. Billing starts once your service is live, and your first Direct Debit is only collected
          after we've given you advance notice.
        </p>
      </div>

      <div className="max-w-xs">
        <Label htmlFor="j2-start-date">Preferred start date</Label>
        <Input
          id="j2-start-date"
          type="date"
          value={date}
          min={earliest}
          max={latest}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="flex items-start gap-3 border-2 border-border p-4">
        <Checkbox id="j2-start-ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
        <Label htmlFor="j2-start-ack" className="text-sm font-normal leading-relaxed">
          I understand this is my preferred date and OCCTA will confirm the actual activation date with me.
        </Label>
      </div>

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Continue to billing"}</Button>
      </div>
    </form>
  );
}
