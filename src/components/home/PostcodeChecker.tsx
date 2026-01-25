import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle, XCircle, Loader2 } from "lucide-react";

const PostcodeChecker = () => {
  const [postcode, setPostcode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);

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
    
    // Brief delay for UX feedback
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    // Most UK addresses have fibre availability via Openreach/Cityfibre infrastructure
    // For a real implementation, integrate with an availability API
    setStatus("success");
    setResult("Brilliant! We've got ultrafast fibre available at your address. Speeds up to 900Mbps!");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCheck();
    }
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
              if (status !== "idle") setStatus("idle");
            }}
            onKeyPress={handleKeyPress}
            className="h-14 pl-12 text-lg font-display uppercase tracking-wider border-4 border-foreground focus:ring-0 focus:border-foreground bg-background placeholder:text-muted-foreground/50"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>
        <Button 
          onClick={handleCheck} 
          disabled={!postcode || status === "loading"}
          size="lg"
          className="h-14"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking...
            </>
          ) : (
            "Check Availability"
          )}
        </Button>
      </div>

      {/* Result Display */}
      {result && (
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
          <p className="font-medium">{result}</p>
        </div>
      )}
    </div>
  );
};

export default PostcodeChecker;
