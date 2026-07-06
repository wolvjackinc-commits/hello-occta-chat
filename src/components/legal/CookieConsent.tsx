import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getConsent, setConsent, initConsent } from "@/lib/consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    initConsent();
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  const decide = (state: "granted" | "denied") => {
    setConsent(state);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t-2 border-foreground bg-background p-4 md:p-6 shadow-2xl"
    >
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="text-sm md:text-base text-foreground">
          <p className="font-bold uppercase tracking-tight">Cookies</p>
          <p className="mt-1 text-muted-foreground">
            We use strictly necessary cookies to run this site. Analytics and
            advertising cookies (Google Analytics, Google Ads) only load if you
            accept. See our{" "}
            <Link to="/cookies" className="underline font-semibold">
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline font-semibold">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => decide("denied")}>
            Reject non-essential
          </Button>
          <Button onClick={() => decide("granted")}>Accept all</Button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;