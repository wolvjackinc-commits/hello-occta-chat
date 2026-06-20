import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";

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

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let mapsLoader: Promise<any> | null = null;
function loadMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve((window as any).google);
  if (mapsLoader) return mapsLoader;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps browser key missing"));
  mapsLoader = new Promise((resolve, reject) => {
    (window as any).__lovInitGmaps = () => resolve((window as any).google);
    const s = document.createElement("script");
    const channel = TRACKING_ID ? `&channel=${encodeURIComponent(TRACKING_ID)}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&libraries=places&callback=__lovInitGmaps${channel}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

function parsePlace(place: any): ParsedAddress {
  const comps: any[] = place.addressComponents ?? place.address_components ?? [];
  const get = (type: string) =>
    comps.find((c) => (c.types || []).includes(type)) || null;
  const longOf = (c: any) => (c ? (c.longText ?? c.long_name ?? "") : "");
  const shortOf = (c: any) => (c ? (c.shortText ?? c.short_name ?? "") : "");

  const streetNumber = longOf(get("street_number"));
  const route = longOf(get("route"));
  const subpremise = longOf(get("subpremise"));
  const premise = longOf(get("premise"));
  const line1 = [streetNumber, route].filter(Boolean).join(" ") || premise || route || "";
  const line2 = subpremise ? `Flat ${subpremise}` : "";
  const city =
    longOf(get("postal_town")) ||
    longOf(get("locality")) ||
    longOf(get("administrative_area_level_2")) ||
    "";
  const postcode = (shortOf(get("postal_code")) || longOf(get("postal_code")) || "").toUpperCase();
  return { line1, line2, city, postcode };
}

export function AddressAutocomplete({
  onSelect,
  onManualFallback,
  initialQuery = "",
  label = "Search your address",
  helperText = "Can't find it? Just type your address in the fields below.",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<any>(null);
  const placesLibRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialQuery && initialQuery !== query) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    loadMaps()
      .then(async (g) => {
        const places = await g.maps.importLibrary("places");
        placesLibRef.current = places;
        sessionTokenRef.current = new (places as any).AutocompleteSessionToken();
      })
      .catch((e) => {
        console.warn("[AddressAutocomplete]", e);
        setError("Address lookup unavailable");
        onManualFallback?.();
      });
  }, [onManualFallback]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query || query.length < 3 || !placesLibRef.current) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const { AutocompleteSuggestion } = placesLibRef.current as any;
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ["gb"],
          language: "en-GB",
        });
        setSuggestions(suggestions || []);
        setOpen(true);
      } catch (e) {
        console.warn("[AddressAutocomplete] fetch failed", e);
        setError("Address lookup unavailable");
        onManualFallback?.();
      } finally {
        setLoading(false);
      }
    }, 220);
  }, [query, onManualFallback]);

  const choose = async (s: any) => {
    try {
      setLoading(true);
      const place = s.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress"],
      });
      const parsed = parsePlace(place);
      onSelect(parsed);
      setQuery(place.formattedAddress || "");
      setOpen(false);
      // reset session token after a selection
      const { AutocompleteSessionToken } = placesLibRef.current as any;
      sessionTokenRef.current = new AutocompleteSessionToken();
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
            const pp = s.placePrediction;
            const main = pp?.mainText?.text ?? "";
            const secondary = pp?.secondaryText?.text ?? "";
            return (
              <li key={i}>
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