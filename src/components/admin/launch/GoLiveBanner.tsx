import { ShieldAlert } from "lucide-react";
import { GO_LIVE_BANNER } from "@/lib/launchSafety/checks";

export const GoLiveBanner = () => (
  <div className="flex items-start gap-3 border-2 border-foreground bg-amber-500 p-4 text-black">
    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
    <p className="text-sm font-medium">{GO_LIVE_BANNER}</p>
  </div>
);