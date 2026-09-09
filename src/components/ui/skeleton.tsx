import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("occta-skeleton overflow-hidden bg-muted", className)} aria-hidden="true" {...props} />;
}

export { Skeleton };
