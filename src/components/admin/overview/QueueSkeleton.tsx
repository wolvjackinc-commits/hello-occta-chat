import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

interface QueueSkeletonProps {
  rows?: number;
}

export const QueueSkeleton = ({ rows = 5 }: QueueSkeletonProps) => {
  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
};

export const KPICardsSkeleton = () => {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-2 border-foreground p-4">
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-8 w-16" />
        </Card>
      ))}
    </div>
  );
};
