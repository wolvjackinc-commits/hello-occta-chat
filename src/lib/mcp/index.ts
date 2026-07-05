import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyOrdersTool from "./tools/list-my-orders";
import listMyInvoicesTool from "./tools/list-my-invoices";
import listMyServicesTool from "./tools/list-my-services";
import listMyTicketsTool from "./tools/list-my-tickets";
import getMyProfileTool from "./tools/get-my-profile";
import getMyBillingSummaryTool from "./tools/get-my-billing-summary";
import listMyPaymentRequestsTool from "./tools/list-my-payment-requests";
import listMyReceiptsTool from "./tools/list-my-receipts";
import getMyRouterStatusTool from "./tools/get-my-router-status";

// The OAuth issuer MUST be the direct Supabase host — never SUPABASE_URL, which
// on Lovable Cloud is a .lovable.cloud proxy that mcp-js rejects at token
// verification time. Build it from VITE_SUPABASE_PROJECT_ID, which Vite inlines
// at build so this stays import-safe (no runtime env read at module load).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "occta-mcp",
  title: "OCCTA",
  version: "0.1.0",
  instructions:
    "OCCTA broadband, phone and SIM account tools for the signed-in customer. Use these to look up the customer's own orders, invoices, services, support tickets and profile. All tools are read-only and scoped to the signed-in user via row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyProfileTool,
    listMyOrdersTool,
    listMyInvoicesTool,
    listMyServicesTool,
    listMyTicketsTool,
    getMyBillingSummaryTool,
    listMyPaymentRequestsTool,
    listMyReceiptsTool,
    getMyRouterStatusTool,
  ],
});