import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle, XCircle, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ICUKAddress {
  [key: string]: unknown;
}

interface AvailabilityResult {
  available: boolean;
  primaryTechnology: string;
  maxDownload: number;
  maxUpload: number;
  eligibleOcctaPlans: string[];
  message?: string;
}

const PLAN_LABELS: Record<string, string> = {
  essential: "Essential (up to 80Mbps)",
  superfast: "Superfast (up to 330Mbps)",
  ultrafast: "Ultrafast (up to 550Mbps)",
  gigabit: "Gigabit (up to 1Gbps)",
};

const PostcodeChecker = () => {
  const [postcode, setPostcode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "addresses" | "checking" | "success" | "error">("idle");
  const [addresses, setAddresses] = useState<ICUKAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<ICUKAddress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [eligiblePlans, setEligiblePlans] = useState<string[]>([]);

  const validatePostcode = (pc: string) => {
    const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    return postcodeRegex.test(pc.trim());
  };

  const handleCheck = async () => {
    if (!validatePostcode(postcode)) {
      setStatus("error");
      setResult("That doesn't look like a proper postcode, mate.");
      return;
    }

    setStatus("loading");
    setAddresses([]);
    setSelectedAddress(null);
    setResult(null);
    setEligiblePlans([]);

    try {
      const { data, error } = await supabase.functions.invoke("check-address", {
        body: { postcode },
      });

      if (error) throw error;

      if (!data.addresses || data.addresses.length === 0) {
        setStatus("error");
        setResult(data.message || "We couldn't automatically find your address. Contact us and we'll check manually.");
        return;
      }

      setAddresses(data.addresses);
      setStatus("addresses");
    } catch (err) {
      console.error("Address lookup error:", err);
      setStatus("error");
      setResult("Something went wrong looking up your address. Please try again.");
    }
  };

  const handleAddressSelect = async (address: ICUKAddress) => {
    setSelectedAddress(address);
    setStatus("checking");
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("check-availability", {
        body: { address },
      });

      if (error) throw error;

      if (data.available && data.eligibleOcctaPlans?.length > 0) {
        const techLabel = data.primaryTechnology === "FTTP" ? "Full Fibre" : "Fibre";
        const speedLabel = data.maxDownload >= 1000
          ? "1Gbps"
          : `${data.maxDownload}Mbps`;

        setEligiblePlans(data.eligibleOcctaPlans);
        setResult(
          `Brilliant! ${techLabel} broadband is available at your address — speeds up to ${speedLabel}!`
        );
        setStatus("success");
      } else {
        setResult(
          data.message || "We don't currently have orderable products at this address. Contact us and we'll check manually."
        );
        setStatus("error");
      }
    } catch (err) {
      console.error("Availability check error:", err);
      setStatus("error");
      setResult("Something went wrong checking availability. Please try again.");
    }
  };

  const getAddressLabel = (addr: ICUKAddress): string => {
    // Build a readable label from the ICUK address object
    const parts = [
      addr.sub_premises,
      addr.premises_name,
      addr.thoroughfare_number,
      addr.thoroughfare_name,
      addr.locality,
      addr.post_town,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(", ") as string;

    // Fallback: use any string-like fields
    const fallback = Object.values(addr).filter(v => typeof v === "string" && v.length > 0);
    return fallback.slice(0, 4).join(", ") || "Address";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCheck();
    }
  };

  const handleReset = () => {
    setPostcode("");
    setStatus("idle");
    setAddresses([]);
    setSelectedAddress(null);
    setResult(null);
    setEligiblePlans([]);
  };

  return (
    <div className="w-full max-w-xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="e.g. HD3 3WU"
            value={postcode}
            onChange={(e) => {
              setPostcode(e.target.value.toUpperCase());
              if (status !== "idle") {
                handleReset();
                setPostcode(e.target.value.toUpperCase());
              }
            }}
            onKeyPress={handleKeyPress}
            className="h-14 pl-12 text-lg font-display uppercase tracking-wider border-4 border-foreground focus:ring-0 focus:border-foreground bg-background placeholder:text-muted-foreground/50"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>
        <Button
          onClick={handleCheck}
          disabled={!postcode || status === "loading" || status === "checking"}
          size="lg"
          className="h-14"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Finding addresses...
            </>
          ) : (
            "Check Availability"
          )}
        </Button>
      </div>

      {/* Address Dropdown */}
      {status === "addresses" && addresses.length > 0 && (
        <div className="mt-4 border-4 border-foreground bg-background animate-slide-up">
          <div className="p-3 border-b-2 border-foreground/10">
            <p className="font-medium text-sm text-muted-foreground">
              {addresses.length} address{addresses.length !== 1 ? "es" : ""} found — select yours:
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {addresses.map((addr, idx) => (
              <button
                key={idx}
                onClick={() => handleAddressSelect(addr)}
                className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b border-foreground/5 last:border-b-0 flex items-center justify-between gap-2"
              >
                <span className="text-sm font-medium">{getAddressLabel(addr)}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 -rotate-90" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Checking spinner */}
      {status === "checking" && (
        <div className="mt-4 p-4 border-4 border-foreground/20 animate-slide-up flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="font-medium">Checking availability at your address...</p>
        </div>
      )}

      {/* Result Display */}
      {result && (status === "success" || status === "error") && (
        <div
          className={`mt-4 p-4 border-4 animate-slide-up flex items-start gap-3 ${
            status === "success"
              ? "border-success bg-success/10"
              : "border-destructive bg-destructive/10"
          }`}
        >
          {status === "success" ? (
            <CheckCircle className="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-medium">{result}</p>
            {status === "success" && eligiblePlans.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {eligiblePlans.map((planId) => (
                  <span
                    key={planId}
                    className="inline-block text-xs font-bold px-2 py-1 bg-primary/10 text-primary border border-primary/20"
                  >
                    {PLAN_LABELS[planId] || planId}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostcodeChecker;
