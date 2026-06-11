import { AlertOctagon } from "lucide-react";
import { HARD_BLOCKERS } from "@/lib/launchSafety/checks";

export const BlockerList = () => (
  <div className="border-2 border-destructive bg-background p-4">
    <div className="mb-3 flex items-center gap-2">
      <AlertOctagon className="h-4 w-4 text-destructive" />
      <h3 className="font-display text-base uppercase tracking-tight">
        Hard blockers
      </h3>
    </div>
    <ul className="space-y-2 text-sm">
      {HARD_BLOCKERS.map((b) => (
        <li key={b} className="flex gap-2">
          <span className="text-destructive">•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
);