import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isSelectableAddressSuggestion, samePostcode } from "@/lib/address/suggestionFilter";

export interface ParsedAddress {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
}

interface Props {
  onSelect: (addr: ParsedAddress) => void;
  onManualFallback?: () => void;
  /** Checked postcode: used only as hidden bias/validation, never prefilled. */
  expectedPostcode?: string;
  label?: string;
  helperText?: string;
  autoFocus?: boolean;
}

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  types?: string[];
};

function newToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function AddressAutocomplete({
  onSelect,
  onManualFallback,
  expectedPostcode = "",
  label = "Search your address",
  helperText = "Start typing house number and street, e.g. 22 Pavilion View.",
  autoFocus = false,
}: Props) {
  // Never prefill the visible field with the postcode: the postcode alone is
  // not an address and Google only offers the locality back.
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const sessionTokenRef = useRef<string>(newToken());

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
          body: {
            action: "suggest",
            input: query,
            expectedPostcode: expectedPostcode || undefined,
            sessionToken: sessionTokenRef.current,
          },
        });
        if (invokeErr || (data as any)?.error) {
          throw new Error((data as any)?.error || invokeErr?.message || "lookup_failed");
        }
        const raw: Suggestion[] = (data as any)?.suggestions || [];
        const list = raw.filter(isSelectableAddressSuggestion);
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
  }, [query, expectedPostcode, onManualFallback]);

  const choose = async (s: Suggestion) => {
    try {
      setLoading(true);
      const { data, error: invokeErr } = await supabase.functions.invoke("places-autocomplete", {
        body: {
          action: "details",
          placeId: s.placeId,
          expectedPostcode: expectedPostcode || undefined,
          sessionToken: sessionTokenRef.current,
        },
      });
      const errorCode = (data as any)?.error;
      if (errorCode === "postcode_mismatch") {
        setError(
          `That address is in ${(data as any)?.postcode || "another postcode"}, not ${expectedPostcode}. Pick another address or change your postcode.`,
        );
        setOpen(false);
        return;
      }
      if (invokeErr || errorCode || !(data as any)?.address) {
        throw new Error(errorCode || invokeErr?.message || "details_failed");
      }
      const addr = (data as any).address as ParsedAddress & { formattedAddress?: string };
      if (!addr.line1?.trim()) throw new Error("not_a_property");
      if (expectedPostcode && addr.postcode && !samePostcode(expectedPostcode, addr.postcode)) {
        setError(
          `That address is in ${addr.postcode}, not ${expectedPostcode}. Pick another address or change your postcode.`,
        );
        setOpen(false);
        return;
      }
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
