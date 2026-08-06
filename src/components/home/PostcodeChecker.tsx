import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ChevronRight, Check, Info } from "lucide-react";
import { useAvailability, getAddressLabel, getShortAddress } from "@/contexts/AvailabilityContext";
import AddressAutocomplete from "@/components/address/AddressAutocomplete";
import { startAssignedJourney } from "@/lib/journey2/route";

interface PostcodeCheckerProps {
  variant?: "hero" | "standalone";
  /** If true, address selection is handled externally (e.g. homepage right panel) */
  externalAddressSelect?: boolean;
}

const PostcodeChecker = ({ variant = "standalone", externalAddressSelect = false }: PostcodeCheckerProps) => {
  const { status, postcode: ctxPostcode, addresses, selectedAddress, result, errorType, checkPostcode, selectAddress, reset, triggerFallback } = useAvailability();
  const [localPostcode, setLocalPostcode] = useState(ctxPostcode || "");
  const [routing, setRouting] = useState(false);
  const navigate = useNavigate();

  // The server decides whether this visitor gets Journey 1 or Journey 2.
  const startJourney = async () => {
    if (routing) return;
    setRouting(true);
    setRoutingError(null);
    await startAssignedJourney((path) => navigate(path), (msg) => setRoutingError(msg));
    setRouting(false);
  };

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
  const showFallback = !externalAddressSelect && status === "error" &&
    (errorType === "backend-unavailable" || errorType === "availability-failed" || errorType === "no-addresses");
  const showManualAddressLookup = showFallback && errorType === "no-addresses";

  const goToFallbackPlans = () => {
    triggerFallback(localPostcode);
    navigate(`/build-plan?availability=fallback${localPostcode ? `&postcode=${encodeURIComponent(localPostcode)}` : ""}`);
  };

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
            aria-label="Postcode"
            placeholder="E.g. HD3 3WU"
            value={localPostcode}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="h-14 pl-12 text-lg font-display uppercase tracking-wider border-4 border-foreground focus:ring-0 focus:border-foreground bg-background placeholder:text-muted-foreground"
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

      {showManualAddressLookup && (
        <div className="mt-4 border-4 border-foreground bg-card p-4">
          <AddressAutocomplete
            initialQuery={localPostcode || ctxPostcode}
            label="Choose your full address"
            helperText="If your address appears here, pick it and we'll check the available plans for that property."
            onSelect={(addr) => {
              selectAddress({
                sub_premises: addr.line2,
                premises_name: addr.line1,
                post_town: addr.city,
                postcode: addr.postcode || localPostcode || ctxPostcode,
              });
            }}
          />
        </div>
      )}

      {showFallback && (
        <div className="mt-4 border-4 border-foreground bg-card p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display uppercase text-sm tracking-wider">Broadband options available to view</p>
              <p className="text-sm text-muted-foreground mt-1">
                We couldn't confirm live availability online right now, but you can still choose the plan you're interested in. We'll confirm the final availability, speed, setup and price before you order.
              </p>
            </div>
          </div>
          <Button
            onClick={goToFallbackPlans}
            size="lg"
            className="mt-4 w-full h-12 font-display uppercase tracking-wider"
          >
            View plans <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Prefer to speak to us? <a href="tel:08002606626" className="underline font-medium">Call 0800 260 6626</a>.
          </p>
        </div>
      )}

      {/* Inline address selection (for pages without external panel) */}
      {showInlineAddresses && (
        <div className="mt-4 border-4 border-foreground bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b-4 border-foreground">
            <p className="font-display text-xs uppercase tracking-wider">
              Select your address — {addresses.length} found for {ctxPostcode}
            </p>
            <button onClick={reset} className="text-[11px] text-primary hover:underline font-medium">
              Change
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {addresses.map((addr, idx) => (
              <button
                key={idx}
                onClick={() => selectAddress(addr)}
                className="w-full text-left px-4 py-3 hover:bg-primary/10 transition-colors border-b-2 border-foreground/10 last:border-b-0 flex items-center justify-between gap-2 group"
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
            {result.primaryTechnology === "FTTP"
              ? "Full Fibre appears available"
              : "Broadband options found"} — {getShortAddress(selectedAddress)}
          </p>
          <button onClick={reset} className="text-xs text-primary hover:underline ml-auto font-medium">
            Change
          </button>
        </div>
      )}

      {showInlineResult && (
        <>
          <p className="text-xs text-muted-foreground mt-2">
            {result?.primaryTechnology === "FTTP"
              ? "Final speed, setup and price are confirmed before order."
              : "Choose your plan and we'll confirm the final speed, setup and price before order."}
          </p>
          <Button
            onClick={startJourney}
            disabled={routing}
            size="lg"
            className="mt-3 w-full h-12 font-display uppercase tracking-wider"
          >
            {routing ? "Preparing…" : "Build your plan"} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </>
      )}

      {/* Fallback when availability API can't confirm */}
      {/* Helper line */}
      {!showInlineAddresses && !showInlineResult && !showFallback && (
        <p className="text-xs text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1">
          <span>✓ Takes 10 seconds</span>
          <span>✓ No commitment</span>
          <span>✓ Final availability confirmed before order</span>
        </p>
      )}
    </div>
  );
};

export default PostcodeChecker;
