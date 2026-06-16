import { useMemo, useState } from "react";
import { format, addDays as dfAddDays, isBefore, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, ShieldCheck, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EARLY_START_WAIVER_TEXT =
  "I expressly request that my OCCTA service begins before the end of my 14-day cooling-off period. I understand that I am giving up my right to cancel free of charge for the portion of the service supplied before I cancel, and that any installation, equipment or one-off charges already incurred remain payable.";

function ymd(d: Date) { return format(d, "yyyy-MM-dd"); }

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
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => dfAddDays(today, 60), [today]);
  const cooEndsAt = journey?.cooling_off_ends_at ? new Date(journey.cooling_off_ends_at) : null;
  const cooEndsDay = cooEndsAt ? startOfDay(cooEndsAt) : null;

  const initial = journey?.preferred_start_date ? new Date(journey.preferred_start_date) : undefined;
  const [date, setDate] = useState<Date | undefined>(initial);
  const [coolingAck, setCoolingAck] = useState<boolean>(!!journey?.cooling_off_acknowledged);
  const [waiverAck, setWaiverAck] = useState<boolean>(!!journey?.early_start_waived);
  const [waiverTextConfirm, setWaiverTextConfirm] = useState<boolean>(!!journey?.early_start_waived);
  const [submitting, setSubmitting] = useState(false);

  const alreadyLocked = !!journey?.start_date_selected_at && !!journey?.preferred_start_date;
  const isEarly = !!(date && cooEndsDay && isBefore(startOfDay(date), cooEndsDay));
  const formValid = !!date && coolingAck && (!isEarly || (waiverAck && waiverTextConfirm));

  const submit = async () => {
    if (!date || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-start-date", {
        body: {
          token,
          preferred_start_date: ymd(date),
          cooling_off_acknowledged: coolingAck,
          early_start_waived: isEarly ? waiverAck : undefined,
          waiver_text_confirmed: isEarly && waiverAck ? EARLY_START_WAIVER_TEXT : undefined,
        },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't save start date",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Start date saved", description: isEarly ? "Early-start waiver recorded." : "We'll start within your cooling-off rights." });
        onSaved();
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (alreadyLocked) {
    return (
      <div className="border-4 border-primary bg-primary/5 p-5 space-y-2">
        <div className="flex items-start gap-3">
          <Check className="w-6 h-6 text-primary flex-shrink-0" />
          <div>
            <p className="font-display uppercase text-sm">Start date locked in</p>
            <p className="text-xs text-muted-foreground">
              We'll begin your service on <strong className="text-foreground">{format(new Date(journey.preferred_start_date), "EEEE d MMMM yyyy")}</strong>.
            </p>
            {journey.early_start_waived && (
              <p className="text-xs mt-2 border-l-4 border-destructive pl-3">
                You waived the remainder of your 14-day cooling-off period on {format(new Date(journey.early_start_waived_at), "d MMM yyyy, HH:mm")} so the service can begin early.
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Cooling-off rights end on {cooEndsAt ? format(cooEndsAt, "EEEE d MMMM yyyy") : "—"}.
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
          <div>
            <p className="font-display uppercase text-sm">Your 14-day cooling-off period</p>
            <p className="text-xs text-muted-foreground">
              By law you have 14 days from the moment you accepted your Contract Summary to cancel free of charge.
              {cooEndsAt && (<> Your cooling-off rights end on <strong className="text-foreground">{format(cooEndsAt, "EEEE d MMMM yyyy, HH:mm")}</strong>.</>)}
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-5 mt-2 space-y-1">
              <li>Pick a start date on or after that day and your cancellation rights are fully preserved.</li>
              <li>Pick a date before then and you'll need to expressly waive the remainder of your cooling-off period.</li>
            </ul>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm pt-2 border-t border-muted">
          <Checkbox checked={coolingAck} onCheckedChange={(v) => setCoolingAck(v === true)} />
          <span>I confirm I understand my 14-day cooling-off rights and how they apply to the start date I choose.</span>
        </label>
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
              disabled={(d) => isBefore(d, today) || isBefore(maxDate, d)}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">You can choose any date from today up to {format(maxDate, "d MMM yyyy")}.</p>

        {isEarly && (
          <div className="border-l-4 border-destructive bg-destructive/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs">
                The date you've chosen is <strong>before your cooling-off period ends</strong>. To start early you must expressly waive the remainder of that period.
              </p>
            </div>
            <p className="text-xs border border-foreground/30 p-3 bg-background leading-relaxed">{EARLY_START_WAIVER_TEXT}</p>
            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={waiverTextConfirm} onCheckedChange={(v) => setWaiverTextConfirm(v === true)} />
              <span>I have read the waiver statement above in full.</span>
            </label>
            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={waiverAck} onCheckedChange={(v) => setWaiverAck(v === true)} />
              <span>I expressly request and waive my cooling-off rights for the period before my chosen start date.</span>
            </label>
          </div>
        )}
      </div>

      <Button
        variant="hero"
        className="w-full font-display uppercase"
        disabled={!formValid || submitting}
        onClick={submit}
      >
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Confirm start date"}
      </Button>
    </div>
  );
}