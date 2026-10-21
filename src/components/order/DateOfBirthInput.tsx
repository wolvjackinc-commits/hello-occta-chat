import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Date of birth as three short number boxes (DD / MM / YYYY) instead of a
 * native date picker, which on phones means scrolling back decades. Uses the
 * numeric keypad and the browser's birthday autofill, moves to the next box
 * automatically, and reports an ISO "YYYY-MM-DD" value (or "" while incomplete).
 */
export default function DateOfBirthInput({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  describedBy?: string;
}) {
  const [initY, initM, initD] = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-") : ["", "", ""];
  const [day, setDay] = useState(initD);
  const [month, setMonth] = useState(initM);
  const [year, setYear] = useState(initY);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const complete = day.length >= 1 && month.length >= 1 && year.length === 4;
    onChange(complete ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "");
  }, [day, month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const digits = (raw: string, max: number) => raw.replace(/\D/g, "").slice(0, max);

  return (
    <div className="flex items-end gap-2" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
      <div className="w-16">
        <label htmlFor={id} className="block text-[11px] text-muted-foreground">Day</label>
        <Input
          id={id}
          value={day}
          inputMode="numeric"
          autoComplete="bday-day"
          placeholder="DD"
          maxLength={2}
          onChange={(e) => {
            const v = digits(e.target.value, 2);
            setDay(v);
            if (v.length === 2) monthRef.current?.focus();
          }}
        />
      </div>
      <div className="w-16">
        <label htmlFor={`${id}-month`} className="block text-[11px] text-muted-foreground">Month</label>
        <Input
          id={`${id}-month`}
          ref={monthRef}
          value={month}
          inputMode="numeric"
          autoComplete="bday-month"
          placeholder="MM"
          maxLength={2}
          onChange={(e) => {
            const v = digits(e.target.value, 2);
            setMonth(v);
            if (v.length === 2) yearRef.current?.focus();
          }}
        />
      </div>
      <div className="w-24">
        <label htmlFor={`${id}-year`} className="block text-[11px] text-muted-foreground">Year</label>
        <Input
          id={`${id}-year`}
          ref={yearRef}
          value={year}
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="YYYY"
          maxLength={4}
          onChange={(e) => setYear(digits(e.target.value, 4))}
        />
      </div>
    </div>
  );
}
