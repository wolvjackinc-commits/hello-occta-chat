import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prewarmContractPipeline, type Journey2Session } from "@/lib/journey2/client";

/** Statutory cooling-off window mirrored by the server. */
const COOLING_OFF_DAYS = 14;
/**
 * The standard online journey schedules start dates only AFTER the cooling-off period ends
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
  const quickPicks = useMemo(
    () => [
      { label: "As soon as possible", value: earliest },
      { label: "A week later", value: ymd(addDays(today, EARLIEST_START_OFFSET_DAYS + 7)) },
      { label: "Two weeks later", value: ymd(addDays(today, EARLIEST_START_OFFSET_DAYS + 14)) },
    ],
    [earliest, today],
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Warm the contract functions while the customer reviews their preferred
    // start date, removing avoidable cold-start time from the Continue click.
    prewarmContractPipeline();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || date < earliest) {
      setErr(`The earliest date we can start is ${pretty(earliest)}, because of your 14-day cancellation period.`);
      return;
    }
    if (date > latest) { setErr("Please choose a date within the next 90 days."); return; }
    setErr(null);
    onSave({ preferred_start_date: date, cooling_off_acknowledged: true });
  };

  return (
    <form onSubmit={submit} className="border-4 border-foreground p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="font-display uppercase text-2xl">Preferred start date</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose when you'd like your service to start. Next you'll review and verify your contract; Direct Debit comes afterwards.
        </p>
      </div>

      <div className="border-2 border-border p-4 text-sm space-y-2">
        <p>
          The standard online journey keeps activation after your <strong>14-day cooling-off period</strong>, so the earliest
          start date is <strong>{pretty(earliest)}</strong>.
        </p>
        <p className="text-muted-foreground">
          Nothing is taken today. Billing starts once your service is live, and your first Direct Debit is only collected
          after we've given you advance notice.
        </p>
      </div>

      {/* One-tap choices for the common cases; the date box stays for anything else. */}
      <fieldset>
        <legend className="font-display uppercase text-xs tracking-widest mb-2">Quick choice</legend>
        <div className="flex flex-wrap gap-2">
          {quickPicks.map((pick) => {
            const selected = date === pick.value;
            return (
              <button
                key={pick.value}
                type="button"
                aria-pressed={selected}
                onClick={() => { setDate(pick.value); setErr(null); }}
                className={`min-h-11 border-2 px-3 py-2 text-left text-sm transition-colors ${selected ? "border-foreground bg-primary text-black" : "border-border hover:border-foreground"}`}
              >
                <span className="block font-display uppercase leading-none">{pick.label}</span>
                <span className="mt-1 block text-xs">{pretty(pick.value)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="max-w-xs">
        <Label htmlFor="j2-start-date">Or pick another date</Label>
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
      <p className="text-xs text-muted-foreground border-l-4 border-foreground pl-3 py-1">
        This is your preferred date. OCCTA will confirm the actual activation date with you during provisioning.
      </p>

      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" disabled={saving}>{saving ? "Preparing…" : "Review my contract"}</Button>
      </div>
    </form>
  );
}
