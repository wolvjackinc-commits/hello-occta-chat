import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/* A yellow shutter that lifts off each new public page: the swap happens under
   it, then it rises away with the OCCTA mark. Only between marketing pages — the
   order, account, admin and payment flows switch instantly — and never for
   reduced-motion visitors or on the first page load. */

const QUIET_PREFIXES = [
  "/order", "/admin", "/dashboard", "/auth", "/.lovable", "/quote", "/receipt", "/dd", "/direct-debit-setup",
  "/pay", "/pay-by-card", "/pay-invoice", "/payment-result", "/checkout", "/pre-checkout", "/business-checkout",
  "/sim/checkout", "/sim/order-success", "/billing-settings", "/business/billing", "/business/contacts",
  "/business/notifications", "/business/support", "/thank-you", "/unsubscribe", "/offline",
];

const isQuiet = (path: string) => QUIET_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

const RouteShutter = () => {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname) return;
    if (isQuiet(from) || isQuiet(pathname)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setRun((r) => r + 1);
  }, [pathname]);

  if (run === 0) return null;

  return (
    <div key={run} aria-hidden className="occ-shutter pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-primary">
      <span className="occ-shutter-mark flex h-20 w-20 items-center justify-center border-4 border-black bg-black font-display text-5xl text-primary">
        O
      </span>
    </div>
  );
};

export default RouteShutter;
