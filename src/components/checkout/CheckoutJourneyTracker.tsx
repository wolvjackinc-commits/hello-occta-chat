import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  checkoutTrackingStarted,
  isCheckoutRoute,
  journeyTokenFromCheckoutPath,
  normalizeCheckoutRoute,
  trackCheckoutEvent,
} from "@/lib/checkoutTracking";

type RouteState = { stage: string; progress: number | null; complete?: boolean };

function routeState(pathname: string): RouteState {
  const route = normalizeCheckoutRoute(pathname);
  if (route === "/order") return { stage: "build_plan", progress: 5 };
  if (route === "/quote/start") return { stage: "quote_start", progress: 10 };
  if (route === "/quote/contract-summary/:token") return { stage: "contract_summary", progress: 70 };
  if (route === "/quote/two-doc/:token") return { stage: "agreement", progress: 80 };
  if (route === "/quote/payment/:token") return { stage: "payment", progress: 90 };
  if (route === "/quote/:token") return { stage: "quote_journey", progress: 60 };
  if (route === "/quote/thank-you") return { stage: "quote_complete", progress: 100, complete: true };
  if (route === "/order") return { stage: "order_start", progress: 5 };
  if (route === "/order/:token") return { stage: "order_journey", progress: null };
  if (route === "/order/:token/complete") return { stage: "complete", progress: 100, complete: true };
  if (route === "/pre-checkout") return { stage: "pre_checkout", progress: 20 };
  if (route === "/checkout") return { stage: "checkout", progress: 60 };
  if (route === "/thank-you") return { stage: "complete", progress: 100, complete: true };
  if (route === "/sim/checkout") return { stage: "sim_checkout", progress: 60 };
  if (route === "/sim/order-success/:orderId") return { stage: "complete", progress: 100, complete: true };
  if (route === "/business-checkout") return { stage: "business_checkout", progress: 60 };
  return { stage: "checkout", progress: null };
}

/**
 * Passive checkout telemetry. It never reads form values and it never blocks a
 * customer action. Dynamic order/quote tokens are removed from the stored route.
 */
export default function CheckoutJourneyTracker() {
  const location = useLocation();
  const tracked = isCheckoutRoute(location.pathname);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tracked) {
      lastPathRef.current = null;
      return;
    }
    const route = normalizeCheckoutRoute(location.pathname);
    if (lastPathRef.current === route) return;
    lastPathRef.current = route;
    const state = routeState(location.pathname);
    const journeyToken = journeyTokenFromCheckoutPath(location.pathname);
    const eventType = state.complete
      ? "complete"
      : checkoutTrackingStarted()
        ? "route_change"
        : "session_start";

    void trackCheckoutEvent({
      eventType,
      route,
      stage: state.stage,
      progressPercent: state.progress,
      journeyToken,
      metadata: { surface: "customer_web" },
    });
  }, [location.pathname, tracked]);

  useEffect(() => {
    if (!tracked) return;
    const route = normalizeCheckoutRoute(location.pathname);
    const state = routeState(location.pathname);
    const journeyToken = journeyTokenFromCheckoutPath(location.pathname);

    const onError = (event: ErrorEvent) => {
      void trackCheckoutEvent({
        eventType: "error",
        route,
        stage: state.stage,
        progressPercent: state.progress,
        journeyToken,
        errorCode: "browser_error",
        errorMessage: event.message || "Browser error during checkout",
        metadata: { surface: "customer_web" },
      });
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unhandled request failure during checkout";
      void trackCheckoutEvent({
        eventType: "error",
        route,
        stage: state.stage,
        progressPercent: state.progress,
        journeyToken,
        errorCode: "unhandled_request",
        errorMessage: message,
        metadata: { surface: "customer_web" },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void trackCheckoutEvent({
        eventType: "heartbeat",
        route,
        stage: state.stage,
        progressPercent: state.progress,
        journeyToken,
        metadata: { surface: "customer_web" },
      });
    }, 30_000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.clearInterval(heartbeat);
    };
  }, [location.pathname, tracked]);

  return null;
}
