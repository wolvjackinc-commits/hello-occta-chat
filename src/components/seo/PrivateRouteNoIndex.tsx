import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/**
 * Centralised noindex/nofollow for private/customer/admin/payment routes.
 * Mounted once inside <BrowserRouter> in App.tsx — no per-page edits needed.
 *
 * Pattern rules (path-prefix or exact):
 *  - /admin, /dashboard, /auth, /billing-settings, /install, /offline
 *  - /checkout, /pre-checkout, /thank-you, /business-checkout
 *  - /pay, /pay-invoice, /payment-result, /dd/setup
 *  - /quote/contract-summary/*, /quote/payment/*, /quote/:token (single segment)
 *  - /dashboard/contract/*, /dashboard/receipt/*, /receipt/*
 *
 * Public funnel pages (KEEP indexable):
 *  - /quote/start, /quote/thank-you, /build-plan
 */
const EXACT_PRIVATE = new Set<string>([
  "/auth",
  "/dashboard",
  "/billing-settings",
  "/install",
  "/offline",
  "/checkout",
  "/pre-checkout",
  "/thank-you",
  "/business-checkout",
  "/pay",
  "/pay-invoice",
  "/payment-result",
  "/dd/setup",
  "/pay/_internal",
]);

const PRIVATE_PREFIXES = [
  "/admin",
  "/.lovable/",
  "/dashboard/",
  "/quote/contract-summary/",
  "/quote/payment/",
  "/receipt/",
];

/** Tokenised Journey 2 order links (/order/:token) must never be indexed. */
const PRIVATE_TOKEN_ROOTS = ["/order/"];

const PUBLIC_QUOTE_PATHS = new Set<string>(["/quote/start", "/quote/thank-you"]);

function isPrivate(pathname: string): boolean {
  if (EXACT_PRIVATE.has(pathname)) return true;
  for (const prefix of PRIVATE_PREFIXES) {
    if (pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix)) return true;
  }
  // Tokenised /quote/:token catch — single extra segment after /quote/
  if (pathname.startsWith("/quote/") && !PUBLIC_QUOTE_PATHS.has(pathname)) {
    const rest = pathname.slice("/quote/".length);
    // /quote/<token> with no further slash → private journey link
    if (rest.length > 0 && !rest.includes("/")) return true;
  }
  for (const root of PRIVATE_TOKEN_ROOTS) {
    if (pathname.startsWith(root) && pathname.slice(root.length).length > 0) return true;
  }
  return false;
}

export default function PrivateRouteNoIndex() {
  const { pathname } = useLocation();
  if (!isPrivate(pathname)) return null;
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
    </Helmet>
  );
}