import { ReactNode } from "react";

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 border-4 border-dashed border-foreground/30 bg-background">
      {icon && <div className="mx-auto mb-3 w-12 h-12 flex items-center justify-center text-muted-foreground">{icon}</div>}
      <h3 className="font-display text-lg uppercase mb-1">{title}</h3>
      {message && <p className="text-sm text-muted-foreground mb-3">{message}</p>}
      {action}
    </div>
  );
}