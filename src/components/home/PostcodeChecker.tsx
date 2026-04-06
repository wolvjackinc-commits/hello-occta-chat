import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ChevronDown } from "lucide-react";
import { useAvailability, getAddressLabel } from "@/contexts/AvailabilityContext";

interface PostcodeCheckerProps {
  variant?: "hero" | "standalone";
}

const PostcodeChecker = ({ variant = "standalone" }: PostcodeCheckerProps) => {
  const { status, addresses, postcode: ctxPostcode, errorMessage, checkPostcode, selectAddress } = useAvailability();
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

  return (
    <div className={`w-full ${isHero ? "max-w-[700px]" : "max-w-xl"}`}>
      {/* Label */}
      <p className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
        Enter your postcode
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
          disabled={!localPostcode || status === "loading-postcode" || status === "checking-address"}
          size="lg"
          className={`h-14 font-display uppercase tracking-wider ${isHero ? "sm:w-[32%] w-full" : ""}`}
        >
          {status === "loading-postcode" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Checking…
            </>
          ) : (
            "Check Availability"
          )}
        </Button>
      </div>

      {/* Helper line */}
      <p className="text-xs text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1">
        <span>✓ Takes 10 seconds</span>
        <span>✓ No commitment</span>
        <span>✓ Real availability</span>
      </p>

      {/* Loading postcode */}
      {status === "loading-postcode" && (
        <div className="mt-4 p-4 border-4 border-foreground/20 animate-slide-up flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="font-medium">Checking your address…</p>
        </div>
      )}

      {/* Address dropdown */}
      {status === "addresses" && addresses.length > 0 && (
        <div className="mt-4 border-4 border-foreground bg-background animate-slide-up">
          <div className="p-3 border-b-2 border-foreground/10">
            <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">
              Select your address
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {addresses.map((addr, idx) => (
              <button
                key={idx}
                onClick={() => selectAddress(addr)}
                className="w-full text-left px-4 py-3.5 hover:bg-accent/50 transition-colors border-b border-foreground/5 last:border-b-0 flex items-center justify-between gap-2"
              >
                <span className="text-sm font-medium">{getAddressLabel(addr)}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 -rotate-90" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Checking address */}
      {status === "checking-address" && (
        <div className="mt-4 p-4 border-4 border-foreground/20 animate-slide-up flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="font-medium">Finding the fastest available speeds…</p>
        </div>
      )}

      {/* Error states */}
      {status === "error" && (
        <div className="mt-4 p-4 border-4 border-destructive bg-destructive/10 animate-slide-up">
          <p className="font-medium text-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default PostcodeChecker;
