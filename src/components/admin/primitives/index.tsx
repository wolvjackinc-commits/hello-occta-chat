import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared admin UI primitives. Purely presentational — no business logic here.
 */

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-display leading-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-2 border-foreground bg-background p-2 rounded-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

const STATUS_MAP: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-600",
  ok: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-600",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-600",
  confirmed: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-600",
  activated: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-600",
  paid: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-600",
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-600",
  processing: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-600",
  sending: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-600",
  verified: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-600",
  suspended: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-600",
  cancelled: "bg-muted text-muted-foreground border-muted-foreground",
  archived: "bg-muted text-muted-foreground border-muted-foreground",
  test: "bg-muted text-muted-foreground border-muted-foreground",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-600",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-600",
  expired: "bg-muted text-muted-foreground border-muted-foreground",
  draft: "bg-muted text-muted-foreground border-muted-foreground",
};

export function AdminStatusBadge({ status, title }: { status: string; title?: string }) {
  const key = (status || "").toLowerCase();
  const cls = STATUS_MAP[key] || "bg-muted text-foreground border-foreground";
  return (
    <Badge
      variant="outline"
      className={cn("border-2 capitalize font-medium", cls)}
      title={title}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function AdminEmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border-2 border-dashed border-foreground/30 bg-background px-6 py-10 text-center">
      {icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base uppercase tracking-tight">{title}</h3>
      {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function AdminActionMenu({
  label = "Actions",
  items,
  align = "end",
}: {
  label?: string;
  align?: "start" | "end" | "center";
  items: Array<
    | { type: "label"; label: string }
    | { type: "separator" }
    | {
        type?: "item";
        label: string;
        onSelect: () => void;
        disabled?: boolean;
        destructive?: boolean;
        icon?: React.ReactNode;
      }
  >;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="border-2 border-foreground">
        {items.map((it, i) => {
          if ((it as any).type === "separator") return <DropdownMenuSeparator key={i} />;
          if ((it as any).type === "label")
            return <DropdownMenuLabel key={i}>{(it as any).label}</DropdownMenuLabel>;
          const item = it as {
            label: string;
            onSelect: () => void;
            disabled?: boolean;
            destructive?: boolean;
            icon?: React.ReactNode;
          };
          return (
            <DropdownMenuItem
              key={i}
              disabled={item.disabled}
              onSelect={(e) => {
                e.preventDefault();
                item.onSelect();
              }}
              className={cn(item.destructive && "text-destructive focus:text-destructive")}
            >
              {item.icon && <span className="mr-2 inline-flex">{item.icon}</span>}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  side?: "right" | "left" | "top" | "bottom";
  wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "border-l-4 border-foreground overflow-y-auto",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <SheetHeader>
          <SheetTitle className="font-display">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-4 space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Toggle: "Include archived/test/cancelled". Default OFF so daily ops stay clean.
 */
export function IncludeArchivedToggle({
  checked,
  onCheckedChange,
  label = "Include archived/test",
  id = "include-archived",
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="text-xs font-medium cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

/**
 * Inline safety label for buttons/sections that trigger live customer actions.
 * Purely visual — does not replace confirmation dialogs.
 */
export function SafetyLabel({
  kind = "info",
  children,
  className,
}: {
  kind?: "info" | "warning";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = kind === "warning" ? AlertTriangle : Info;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide px-1.5 py-0.5 border-2",
        kind === "warning"
          ? "border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/10"
          : "border-foreground/40 text-muted-foreground bg-muted/30",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

/**
 * Default filter helper: given a row's status string, decide if it counts as archived/test.
 */
export function isArchivedLike(status?: string | null) {
  const s = (status || "").toLowerCase();
  return s === "cancelled" || s === "archived" || s === "test" || s === "demo" || s === "internal";
}