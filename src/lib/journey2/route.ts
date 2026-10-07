import { journey2, type StartResult } from "./client";

const JOURNEY1_ROUTE = "/quote/start?interest=broadband";
const ANON_SESSION_KEY = "occta_j2_anon_id";

let preparedStartPromise: Promise<StartResult> | null = null;

function clearAnonymousJourneyIdentity() {
  try {
    localStorage.removeItem(ANON_SESSION_KEY);
  } catch {
    // Storage can be unavailable in privacy modes. The normal retry path still
    // works when storage is available again.
  }
}

async function resolveAssignedJourneyStart(): Promise<StartResult> {
  let res = await journey2.start();

  if (res?.token && res.resumed) {
    const resumed = await journey2.get(res.token).catch(() => null);
    if (resumed?.error === "session_expired") {
      clearAnonymousJourneyIdentity();
      res = await journey2.start();
    }
  }
  return res;
}

function ensurePreparedStart(): Promise<StartResult> {
  if (!preparedStartPromise) {
    preparedStartPromise = resolveAssignedJourneyStart().catch((error) => {
      preparedStartPromise = null;
      throw error;
    });
  }
  return preparedStartPromise;
}

/**
 * Starts the server-side order-session assignment in the background as soon as
 * the customer has selected an address. This removes that network round-trip
 * from the later "Choose plan" click without creating sessions for casual
 * homepage visitors.
 */
export function prewarmAssignedJourney(): void {
  void ensurePreparedStart().catch(() => {
    // OrderStart will retry normally if the speculative request failed.
  });
}

/**
 * Used by /order after the UI has navigated immediately. If a prewarmed
 * assignment is ready it is consumed; otherwise the same in-flight request is
 * awaited rather than issuing a duplicate session request.
 */
export async function consumePreparedJourneyStart(): Promise<StartResult> {
  const promise = ensurePreparedStart();
  try {
    return await promise;
  } finally {
    if (preparedStartPromise === promise) preparedStartPromise = null;
  }
}

/**
 * Sends the visitor into whichever journey the server assigns them.
 *
 * The server is the only thing that decides which journey a visitor is in.
 * A Journey 2 assignment is never silently downgraded to Journey 1.
 */
export async function startAssignedJourney(
  navigate: (path: string) => void,
  onError?: (message: string) => void,
): Promise<void> {
  try {
    const res = await consumePreparedJourneyStart();

    if (res?.token) return navigate(`/order/${res.token}`);
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
