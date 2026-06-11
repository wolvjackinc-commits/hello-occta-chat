import type { TaskSuggestion } from "./types";

/**
 * Pure, read-only task suggestions. Nothing persists from this module —
 * the admin must explicitly click "Create task" in the UI.
 */
export const STATIC_SUGGESTIONS: TaskSuggestion[] = [
  {
    key: "payment-pending-confirmation",
    title: "Payment pending confirmation",
    description:
      "Worldpay webhook has not yet confirmed a recent payment request. Verify with finance before proceeding.",
    priority: "high",
  },
  {
    key: "customer-not-accepted-cs",
    title: "Customer has not accepted Contract Summary",
    description: "Contact customer to walk through the Contract Summary and confirm acceptance.",
    priority: "medium",
  },
  {
    key: "webhook-pending",
    title: "Worldpay webhook pending sign-off",
    description: "Live webhook signing secret is still outstanding — track follow-up actions here.",
    priority: "urgent",
  },
  {
    key: "review-readiness",
    title: "Review readiness checklist",
    description: "Run through the provisioning readiness checks for the customer before any supplier order.",
    priority: "medium",
  },
  {
    key: "missing-contact-details",
    title: "Call customer for missing contact details",
    description: "Profile is missing DOB or postcode. Call to capture KYC details.",
    priority: "low",
  },
];