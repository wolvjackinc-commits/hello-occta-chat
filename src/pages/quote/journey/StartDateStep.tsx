import { useMemo, useState, useEffect } from "react";
import { format, isBefore, isAfter, startOfDay, addDays as dfAdd } from "date-fns";
import { CalendarIcon, Loader2, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PREFERRED_DATE_ACK =
  "I understand that this is my preferred service start date and that OCCTA will confirm the actual activation date.";

function parseYmdLocal(ymd: string): Date {
  // Treat YYYY-MM-DD as a London/UK local date — the calendar uses local-day math
  // so constructing from parts avoids UTC-vs-local off-by-one issues.
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}
function ymdFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export default function StartDateStep({
  token,
  journey,
  onSaved,
}: {
  token: string;
  journey: any;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  // Server-provided values. Never compute cooling-off in the client.
  const earliest = journey?.earliest_selectable_start_date
    ? parseYmdLocal(journey.earliest_selectable_start_date)
    : null;
  const coolEnd = journey?.cooling_off_ends_at ? new Date(journey.cooling_off_ends_at) : null;

  // Maximum date is informational — server is authoritative. We fetch the config
  // value once so the calendar gives the right affordance.
  const [maxDays, setMaxDays] = useState<number>(90);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("start_date_max_days")
        .limit(1).maybeSingle();
      if (!cancelled && data?.start_date_max_days) setMaxDays(Number(data.start_date_max_days));
    })();
    return () => { cancelled = true; };
  }, []);
  const maxDate = useMemo(() => dfAdd(startOfDay(new Date()), maxDays), [maxDays]);

  const initial = journey?.preferred_start_date ? parseYmdLocal(journey.preferred_start_date) : undefined;
  const [date, setDate] = useState<Date | undefined>(initial);
  const [ack, setAck] = useState<boolean>(!!journey?.cooling_off_acknowledged);
  const [submitting, setSubmitting] = useState(false);

  const alreadyLocked = !!journey?.start_date_selected_at && !!journey?.preferred_start_date;
  const formValid = !!date && ack && earliest && !isBefore(startOfDay(date), startOfDay(earliest));

  const submit = async () => {
    if (!date || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-start-date", {
        body: {
          token,
          preferred_start_date: ymdFromDate(date),
          cooling_off_acknowledged: ack,
        },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't save start date",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Start date saved", description: "We'll confirm your actual activation date shortly." });
        onSaved();
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (!earliest || !coolEnd) {
    return (
      <div className="border-4 border-foreground p-6 text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
        Preparing your cooling-off dates…
      </div>
    );
  }

  if (alreadyLocked) {
    return (
      <div className="border-4 border-primary bg-primary/5 p-5 space-y-2">
        <div className="flex items-start gap-3">
          <Check className="w-6 h-6 text-primary flex-shrink-0" />
          <div>
            <p className="font-display uppercase text-sm">Preferred start date saved</p>
            <p className="text-xs text-muted-foreground">
              Preferred date: <strong className="text-foreground">{format(parseYmdLocal(journey.preferred_start_date), "EEEE d MMMM yyyy")}</strong>.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Your 14-day cooling-off period ends on <strong className="text-foreground">{format(coolEnd, "EEEE d MMMM yyyy 'at' HH:mm")}</strong> (Europe/London). The earliest standard service start date you can select is <strong className="text-foreground">{format(earliest, "EEEE d MMMM yyyy")}</strong>.
            </p>
            <p className="text-xs text-muted-foreground mt-2 border-l-4 border-foreground pl-3">
              Your selected date is preferred and subject to availability. OCCTA will confirm your actual activation date. Billing begins only after your service has been confirmed as active.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-4 border-foreground p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 mt-0.5" />
          <div className="space-y-2">
            <p className="font-display uppercase text-sm">Your 14-day cooling-off period</p>
            <p className="text-sm">
              Your 14-day cooling-off period ends on <strong>{format(coolEnd, "EEEE d MMMM yyyy 'at' HH:mm")}</strong> (Europe/London). The earliest standard service start date you can select is <strong>{format(earliest, "EEEE d MMMM yyyy")}</strong>.
            </p>
            <p className="text-sm border-l-4 border-foreground pl-3">
              Your selected date is preferred and subject to availability. OCCTA will confirm your actual activation date. Billing begins only after your service has been confirmed as active.
            </p>
          </div>
        </div>
      </div>

      <div className="border-4 border-foreground p-5 space-y-3">
        <p className="font-display uppercase text-sm">Preferred start date</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start text-left font-normal h-12", !date && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "EEEE d MMMM yyyy") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
              defaultMonth={date ?? earliest}
              disabled={(d) => isBefore(startOfDay(d), startOfDay(earliest)) || isAfter(startOfDay(d), startOfDay(maxDate))}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          You can choose any date from <strong>{format(earliest, "d MMM yyyy")}</strong> up to <strong>{format(maxDate, "d MMM yyyy")}</strong>.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm border-4 border-foreground p-4">
        <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} />
        <span>{PREFERRED_DATE_ACK}</span>
      </label>

      <Button
        variant="hero"
        className="w-full font-display uppercase"
        disabled={!formValid || submitting}
        onClick={submit}
      >
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Confirm preferred start date"}
      </Button>
    </div>
  );
}