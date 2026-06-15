import { AlertTriangle } from "lucide-react";

/**
 * Required Digital Voice / VoIP emergency-call disclosure.
 * Use wherever Digital Voice / Home Phone over broadband is promoted or sold.
 */
export function EmergencyCallNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`border-2 border-warning bg-warning/10 p-3 text-xs flex gap-2 items-start ${className}`}
      role="note"
      aria-label="Digital Voice emergency call notice"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning-foreground" />
      <span>
        <strong>Important:</strong> Digital Voice needs power and broadband to work.
        Emergency calls (999/112) may not work during a power cut or broadband outage.
        If you or someone in your household relies on a phone line in an emergency,
        please tell us so we can discuss back-up options.
      </span>
    </div>
  );
}

export default EmergencyCallNote;