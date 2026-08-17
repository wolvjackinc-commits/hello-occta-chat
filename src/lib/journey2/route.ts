import { journey2 } from "./client";

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
    // The server explicitly assigned Journey 1 (quote-led).
    if (res?.redirect) return navigate(res.redirect);
    if (res?.journey_version === "v1") return navigate("/order");
    throw new Error(res?.message ?? "assignment_unavailable");
  } catch (e) {
    onError?.(
      (e as Error)?.message === "assignment_unavailable"
        ? "We couldn't start your order just now. Please try again in a moment."
        : "We couldn't reach our ordering service just now. Please try again in a moment.",
    );
  }
}
