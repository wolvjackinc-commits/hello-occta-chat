import { Suspense } from "react";
import {
  KPICards,
  NewOrdersQueue,
  TicketsSLAQueue,
  FailedPaymentsQueue,
  DDMandatesQueue,
  InstallationsQueue,
  QueueSkeleton,
  KPICardsSkeleton,
} from "@/components/admin/overview";

export const AdminOverview = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Operations Dashboard</h1>
        <p className="text-muted-foreground">
          Daily work queues and actionable items for the admin team.
        </p>
      </div>

      {/* KPI Cards */}
      <Suspense fallback={<KPICardsSkeleton />}>
        <KPICards />
      </Suspense>

      {/* Work Queues Grid */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* New Orders Queue */}
        <Suspense fallback={<QueueSkeleton rows={5} />}>
          <NewOrdersQueue />
        </Suspense>

        {/* Tickets SLA Queue */}
        <Suspense fallback={<QueueSkeleton rows={5} />}>
          <TicketsSLAQueue />
        </Suspense>

        {/* Failed Payments Queue */}
        <Suspense fallback={<QueueSkeleton rows={5} />}>
          <FailedPaymentsQueue />
        </Suspense>

        {/* DD Mandates Pending Queue */}
        <Suspense fallback={<QueueSkeleton rows={5} />}>
          <DDMandatesQueue />
        </Suspense>

        {/* Installations Upcoming Queue - Full width */}
        <div className="xl:col-span-2">
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <InstallationsQueue />
          </Suspense>
        </div>
      </div>
    </div>
  );
};
