import { Suspense } from "react";
import {
  KPICards,
  NewOrdersQueue,
  TicketsSLAQueue,
  FailedPaymentsQueue,
  DDMandatesQueue,
  InstallationsQueue,
  OverdueInvoicesQueue,
  InvoicesDueSoonQueue,
  UnassignedTicketsQueue,
  CustomersNeedingAttentionQueue,
  ComplianceIssuesQueue,
  QueueSkeleton,
  KPICardsSkeleton,
} from "@/components/admin/overview";

export const AdminOverview = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display">Operations Dashboard</h1>
        <p className="text-muted-foreground">
          Daily work queues and actionable items for the admin team.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          💡 Tip: bookmark <code className="bg-muted px-1 py-0.5 rounded">/admin</code> for direct admin access.
        </p>
      </div>

      {/* KPI Cards */}
      <Suspense fallback={<KPICardsSkeleton />}>
        <KPICards />
      </Suspense>

      {/* BILLING & PAYMENTS Section */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-display text-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
          Billing & Payments
        </h2>
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Overdue Invoices - High Priority */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <OverdueInvoicesQueue />
          </Suspense>

          {/* Invoices Due Soon */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <InvoicesDueSoonQueue />
          </Suspense>

          {/* Failed Payments Queue */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <FailedPaymentsQueue />
          </Suspense>

          {/* DD Mandates Pending Queue */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <DDMandatesQueue />
          </Suspense>
        </div>
      </section>

      {/* ORDERS & CUSTOMERS Section */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-display text-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          Orders & Customers
        </h2>
        <div className="grid gap-6 xl:grid-cols-2">
          {/* New Orders Queue */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <NewOrdersQueue />
          </Suspense>

          {/* Customers Needing Attention */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <CustomersNeedingAttentionQueue />
          </Suspense>
        </div>
      </section>

      {/* SUPPORT Section */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-display text-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          Support
        </h2>
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Tickets SLA Queue */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <TicketsSLAQueue />
          </Suspense>

          {/* Unassigned Tickets */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <UnassignedTicketsQueue />
          </Suspense>
        </div>
      </section>

      {/* OPERATIONS Section */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-display text-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
          Operations & Compliance
        </h2>
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Installations Upcoming Queue */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <InstallationsQueue />
          </Suspense>

          {/* Compliance Issues */}
          <Suspense fallback={<QueueSkeleton rows={5} />}>
            <ComplianceIssuesQueue />
          </Suspense>
        </div>
      </section>
    </div>
  );
};
