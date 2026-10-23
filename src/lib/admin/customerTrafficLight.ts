/**
 * Read-only operational traffic light for the admin Customers list.
 * Service and invoice records are authoritative; an accepted contract or an
 * "active" order is NOT evidence that a line is live.
 */
export type CustomerLightColour = "green" | "yellow" | "red" | "grey";

export type CustomerTrafficLight = {
  colour: CustomerLightColour;
  label: string;
  reason: string;
};

export type CustomerAccountSignals = {
  sourceReady: boolean;
  hasSubmittedOrder?: boolean | null;
  hasService?: boolean | null;
  contractStatus?: string | null;
  serviceStatuses: Array<string | null>;
  orderStatuses: Array<string | null>;
  invoices: Array<{
    status: string | null;
    due_date: string | null;
    total: number | string | null;
  }>;
};

const CLOSED_INVOICE_STATUSES = new Set([
  "paid", "void", "cancelled", "canceled", "written_off", "refunded",
]);
const UNISSUED_INVOICE_STATUSES = new Set(["draft"]);
const LIVE_SERVICE_STATUSES = new Set(["active", "live", "connected"]);
const BLOCKED_SERVICE_STATUSES = new Set([
  "suspended", "restricted", "barred", "disconnected",
]);
const PROVISIONING_SERVICE_STATUSES = new Set([
  "pending", "provisioning", "processing", "ordered", "installing",
  "awaiting_installation", "awaiting_activation", "scheduled",
]);
const CLOSED_SERVICE_STATUSES = new Set([
  "cancelled", "canceled", "ceased", "terminated", "inactive", "closed",
]);
const FAILED_ORDER_STATUSES = new Set(["rejected", "failed"]);
const CLOSED_ORDER_STATUSES = new Set([
  "cancelled", "canceled", "rejected", "failed", "closed",
]);

const normalise = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Date boundary must be the UK billing date, not the admin's local timezone. */
const ukToday = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (part: string) => parts.find((p) => p.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

export function getCustomerTrafficLight(
  signals: CustomerAccountSignals,
  now: Date = new Date(),
): CustomerTrafficLight {
  if (!signals.sourceReady) {
    return {
      colour: "grey",
      label: "Checking status",
      reason: "Operational records have not loaded or could not be verified.",
    };
  }

  const today = ukToday(now);
  const paymentDue = signals.invoices.some((invoice) => {
    const status = normalise(invoice.status);
    if (CLOSED_INVOICE_STATUSES.has(status) || UNISSUED_INVOICE_STATUSES.has(status)) return false;
    const total = Number(invoice.total);
    if (!Number.isFinite(total) || total <= 0) return false;
    if (status === "overdue") return true;
    const dueDate = invoice.due_date?.slice(0, 10) ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate <= today;
  });
  if (paymentDue) {
    return {
      colour: "red",
      label: "Payment due",
      reason: "An unpaid invoice has reached its due date or is marked overdue.",
    };
  }

  const services = signals.serviceStatuses.map(normalise);
  if (services.some((status) => BLOCKED_SERVICE_STATUSES.has(status))) {
    return {
      colour: "red",
      label: "Service restricted",
      reason: "At least one service is suspended, restricted or disconnected.",
    };
  }

  if (services.some((status) => LIVE_SERVICE_STATUSES.has(status))) {
    return {
      colour: "green",
      label: "Live",
      reason: "An OCCTA service record is marked active. This is not a live network test.",
    };
  }

  const orders = signals.orderStatuses.map(normalise);
  if (services.some((status) => PROVISIONING_SERVICE_STATUSES.has(status))) {
    return {
      colour: "yellow",
      label: "Provisioning",
      reason: "A service is pending installation or activation.",
    };
  }

  const hasOpenOrder = orders.some((status) => status && !CLOSED_ORDER_STATUSES.has(status));
  const hasClosedService = services.length > 0 &&
    services.every((status) => CLOSED_SERVICE_STATUSES.has(status));
  const allOrdersClosed = orders.length > 0 &&
    orders.every((status) => CLOSED_ORDER_STATUSES.has(status));

  if (hasOpenOrder || (signals.hasSubmittedOrder === true && !allOrdersClosed && !hasClosedService)) {
    return {
      colour: "yellow",
      label: "Provisioning",
      reason: "An order was submitted, but no active service is confirmed.",
    };
  }

  if (orders.some((status) => FAILED_ORDER_STATUSES.has(status)) && !hasOpenOrder) {
    return {
      colour: "red",
      label: "Order failed",
      reason: "An order failed or was rejected and requires investigation.",
    };
  }

  if (hasClosedService || allOrdersClosed) {
    return {
      colour: "grey",
      label: "Closed / inactive",
      reason: "Recorded services or orders are closed; no active service is confirmed.",
    };
  }

  if (signals.hasService && !services.length) {
    return {
      colour: "grey",
      label: "Status unavailable",
      reason: "A service exists, but its current status could not be verified.",
    };
  }

  if (services.length > 0) {
    return {
      colour: "grey",
      label: "Status unknown",
      reason: "No recognised active, pending, restricted or closed service status.",
    };
  }

  return {
    colour: "red",
    label: "Order not submitted",
    reason: signals.contractStatus === "accepted"
      ? "Contract accepted, but the final order submission is not recorded."
      : "No submitted order or active service is recorded for this account.",
  };
}
