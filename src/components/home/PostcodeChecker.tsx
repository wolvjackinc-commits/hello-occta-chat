import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ChevronRight, Check } from "lucide-react";
import { useAvailability, getAddressLabel, getShortAddress } from "@/contexts/AvailabilityContext";

interface PostcodeCheckerProps {
  variant?: "hero" | "standalone";
  /** If true, address selection is handled externally (e.g. homepage right panel) */
  externalAddressSelect?: boolean;
}

const PostcodeChecker = ({ variant = "standalone", externalAddressSelect = false }: PostcodeCheckerProps) => {
  const { status, postcode: ctxPostcode, addresses, selectedAddress, result, checkPostcode, selectAddress, reset } = useAvailability();
  const [localPostcode, setLocalPostcode] = useState(ctxPostcode || "");

  const handleCheck = () => {
    checkPostcode(localPostcode);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCheck();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalPostcode(e.target.value.toUpperCase());
  };

  const isHero = variant === "hero";
  const isLoading = status === "loading-postcode" || status === "checking-address";
  const showInlineAddresses = !externalAddressSelect && status === "addresses" && addresses.length > 0;
  const showInlineResult = !externalAddressSelect && status === "success" && result;

  return (
    <div className={`w-full ${isHero ? "max-w-[700px]" : "max-w-xl"}`}>
      {/* Label */}
      <p className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
        {showInlineResult ? "Checked for" : "Enter your postcode"}
      </p>

      {/* Input row */}
      <div className={`flex gap-4 ${isHero ? "flex-col sm:flex-row" : "flex-col sm:flex-row"}`}>
        <div className={`relative ${isHero ? "sm:w-[68%] w-full" : "flex-1"}`}>
          <Input
            type="text"
            placeholder="E.g. HD3 3WU"
            value={localPostcode}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="h-14 pl-12 text-lg font-display uppercase tracking-wider border-4 border-foreground focus:ring-0 focus:border-foreground bg-background placeholder:text-muted-foreground/50"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>
        <Button
          onClick={handleCheck}
          disabled={!localPostcode || isLoading}
          size="lg"
          className={`h-14 font-display uppercase tracking-wider ${isHero ? "sm:w-[32%] w-full" : ""}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Checking…
            </>
          ) : showInlineResult ? (
            "Check Again"
          ) : (
            "Check Availability"
          )}
        </Button>
      </div>

      {/* Inline address selection (for pages without external panel) */}
      {showInlineAddresses && (
        <div className="mt-3 border-2 border-foreground/10 bg-card">
          <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10">
            <p className="font-display text-xs uppercase tracking-wider">
              {addresses.length} addresses found for {ctxPostcode}
            </p>
            <button onClick={reset} className="text-[11px] text-primary hover:underline font-medium">
              Change
            </button>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {addresses.map((addr, idx) => (
              <button
                key={idx}
                onClick={() => selectAddress(addr)}
                className="w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors border-b border-foreground/5 last:border-b-0 flex items-center justify-between gap-2 group"
              >
                <span className="text-sm font-medium">{getAddressLabel(addr)}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline confirmation after result */}
      {showInlineResult && selectedAddress && (
        <div className="mt-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm font-medium text-foreground">
            {result.primaryTechnology === "FTTP" ? "Full Fibre" : "Fibre"} available — {getShortAddress(selectedAddress)}
          </p>
          <button onClick={reset} className="text-xs text-primary hover:underline ml-auto font-medium">
            Change
          </button>
        </div>
      )}

      {/* Helper line */}
      {!showInlineAddresses && !showInlineResult && (
        <p className="text-xs text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1">
          <span>✓ Takes 10 seconds</span>
          <span>✓ No commitment</span>
          <span>✓ Real availability</span>
        </p>
      )}
    </div>
  );
};

export default PostcodeChecker;
