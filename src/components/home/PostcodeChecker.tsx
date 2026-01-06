import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2, CheckCircle } from "lucide-react";
import { z } from "zod";

const postcodeSchema = z.string()
  .min(5, "That's a bit short for a postcode, innit?")
  .max(8, "That postcode is longer than a Monday morning")
  .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, "That doesn't look like a UK postcode. Try something like 'HD3 3WU'");

interface PostcodeCheckerProps {
  variant?: "hero" | "compact";
}

const PostcodeChecker = ({ variant = "hero" }: PostcodeCheckerProps) => {
  const [postcode, setPostcode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ available: boolean; message: string } | null>(null);

  const handleCheck = async () => {
    setError(null);
    setResult(null);
    
    const validation = postcodeSchema.safeParse(postcode);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setIsChecking(true);
    
    // Simulate API check - in production this would hit a real postcode API
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Mock result
    const isAvailable = Math.random() > 0.2;
    setResult({
      available: isAvailable,
      message: isAvailable 
        ? "Brilliant! We can hook you up with blazing fast broadband. 🎉"
        : "We're working on reaching your area! Pop your email below and we'll let you know when we arrive.",
    });
    
    setIsChecking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCheck();
    }
  };

  if (variant === "compact") {
    return (
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter your postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            className="pl-10 h-11"
            maxLength={8}
          />
        </div>
        <Button onClick={handleCheck} disabled={isChecking}>
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <div className="relative">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter your postcode (e.g., HD3 3WU)"
              value={postcode}
              onChange={(e) => {
                setPostcode(e.target.value.toUpperCase());
                setError(null);
                setResult(null);
              }}
              onKeyDown={handleKeyDown}
              className="pl-12 h-14 text-lg rounded-xl border-2 border-border focus:border-primary transition-colors"
              maxLength={8}
            />
          </div>
          <Button 
            onClick={handleCheck} 
            disabled={isChecking || !postcode}
            variant="hero"
            size="lg"
            className="h-14 px-8"
          >
            {isChecking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span className="hidden sm:inline">Check</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm animate-fade-in">
          <span>🤔</span>
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-xl animate-slide-up ${
          result.available 
            ? "bg-success/10 border border-success/20" 
            : "bg-warning/10 border border-warning/20"
        }`}>
          <div className="flex items-start gap-3">
            {result.available ? (
              <CheckCircle className="w-6 h-6 text-success mt-0.5" />
            ) : (
              <span className="text-2xl">📮</span>
            )}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.available && (
                <Button variant="hero" size="sm" className="mt-3">
                  View Available Packages
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostcodeChecker;
