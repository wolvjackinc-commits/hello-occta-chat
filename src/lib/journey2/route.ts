import { journey2 } from "./client";

const JOURNEY1_ROUTE = "/quote/start?interest=broadband";

/**
 * Sends the visitor into whichever journey the server assigns them.
 *
 * The server is the only thing that decides which journey a visitor is in.
 * A Journey 2 assignment is never silently downgraded to Journey 1: when the
 * assignment service itself is unreachable we surface a retryable error to the
 * caller instead of redirecting.
 */
export async function startAssignedJourney(
  navigate: (path: string) => void,
  onError?: (message: string) => void,
): Promise<void> {
  try {
    const res = await journey2.start();
    if (res?.token) return navigate(`/order/${res.token}`);
    // Older server deployments returned /order for a v1 assignment, which
    // points back to the assignment entry route and can loop forever. Treat any
    // explicit v1 assignment as the quote-led journey instead.
    if (res?.journey_version === "v1") return navigate(JOURNEY1_ROUTE);
    if (res?.redirect && res.redirect !== "/order") return navigate(res.redirect);
    throw new Error(res?.message ?? "assignment_unavailable");
  } catch (e) {
    onError?.(
      (e as Error)?.message === "assignment_unavailable"
        ? "We couldn't start your order just now. Please try again in a moment."
        : "We couldn't reach our ordering service just now. Please try again in a moment.",
    );
  }
}
