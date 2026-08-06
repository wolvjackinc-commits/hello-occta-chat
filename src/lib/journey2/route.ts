import { journey2 } from "./client";

/**
 * Sends the visitor into whichever journey the server assigns them.
 *
 * Journey 1 (quote-led) remains the default: if assignment is unavailable for
 * any reason, the visitor continues to /build-plan exactly as before.
 */
export async function startAssignedJourney(
  navigate: (path: string) => void,
  fallback = "/build-plan",
): Promise<void> {
  try {
    const res = await journey2.start();
    if (res?.token) return navigate(`/order/${res.token}`);
    if (res?.redirect) return navigate(res.redirect);
  } catch {
    /* fall through to Journey 1 */
  }
  navigate(fallback);
}
