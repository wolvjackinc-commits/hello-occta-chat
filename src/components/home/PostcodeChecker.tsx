import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useAvailability } from "@/contexts/AvailabilityContext";

interface PostcodeCheckerProps {
  variant?: "hero" | "standalone";
}

const PostcodeChecker = ({ variant = "standalone" }: PostcodeCheckerProps) => {
  const { status, postcode: ctxPostcode, checkPostcode } = useAvailability();
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
          disabled={!localPostcode || isLoading}
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
    </div>
  );
};

export default PostcodeChecker;
