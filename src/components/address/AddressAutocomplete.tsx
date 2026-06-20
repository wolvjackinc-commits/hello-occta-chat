import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface ParsedAddress {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
}

interface Props {
  onSelect: (addr: ParsedAddress) => void;
  onManualFallback?: () => void;
  initialQuery?: string;
  label?: string;
  helperText?: string;
}

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

function newToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function AddressAutocomplete({
  onSelect,
  onManualFallback,
  initialQuery = "",
  label = "Search your address",
  helperText = "Can't find it? Just type your address in the fields below.",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const sessionTokenRef = useRef<string>(newToken());

  useEffect(() => {
    if (initialQuery) {
      setQuery((current) => (current === initialQuery ? current : initialQuery));
    }
  }, [initialQuery]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const { data, error: invokeErr } = await supabase.functions.invoke("places-autocomplete", {
          body: { action: "suggest", input: query, sessionToken: sessionTokenRef.current },
        });
        if (invokeErr || (data as any)?.error) {
          throw new Error((data as any)?.error || invokeErr?.message || "lookup_failed");
        }
        const list: Suggestion[] = (data as any)?.suggestions || [];
        setSuggestions(list);
        setOpen(list.length > 0);
        setError(null);
      } catch (e) {
        console.warn("[AddressAutocomplete] fetch failed", e);
        setError("Address lookup unavailable");
        onManualFallback?.();
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query, onManualFallback]);

  const choose = async (s: Suggestion) => {
    try {
      setLoading(true);
      const { data, error: invokeErr } = await supabase.functions.invoke("places-autocomplete", {
        body: { action: "details", placeId: s.placeId, sessionToken: sessionTokenRef.current },
      });
      if (invokeErr || (data as any)?.error || !(data as any)?.address) {
        throw new Error((data as any)?.error || invokeErr?.message || "details_failed");
      }
      const addr = (data as any).address as ParsedAddress & { formattedAddress?: string };
      onSelect({ line1: addr.line1, line2: addr.line2, city: addr.city, postcode: addr.postcode });
      setQuery(addr.formattedAddress || [s.mainText, s.secondaryText].filter(Boolean).join(", "));
      setOpen(false);
      sessionTokenRef.current = newToken();
    } catch (e) {
      console.warn("[AddressAutocomplete] details failed", e);
      setError("Could not load address details. Enter manually below.");
      onManualFallback?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" /> {label}
      </Label>
      <div className="relative mt-1">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Start typing your postcode or street…"
          className="h-12 border-4 border-foreground focus:ring-0 focus:border-foreground bg-background pr-9 rounded-none"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto border-4 border-foreground bg-background shadow-[6px_6px_0_0_hsl(var(--foreground))] rounded-none">
          {suggestions.map((s, i) => {
            const main = s.mainText || s.fullText;
            const secondary = s.secondaryText;
            return (
              <li key={s.placeId || i}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  className="w-full text-left px-3 py-2.5 hover:bg-primary/10 border-b-2 border-foreground/10 last:border-b-0 transition-colors"
                >
                  <div className="text-sm font-medium">{main}</div>
                  {secondary && (
                    <div className="text-xs text-muted-foreground">{secondary}</div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {error || helperText}
      </p>
    </div>
  );
}

export default AddressAutocomplete;
