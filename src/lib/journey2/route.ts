import { journey2, journeyCapabilities, type StartResult } from "./client";

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

// While the customer reads the plan cards we also fetch what /order/:token loads
// first (the session and the catalogue, ~1-4s each on a cold backend), so the
// "Choose plan" click only has to render. Each primed result is used once and
// only while fresh; anything missing or failed falls back to a normal request.
type SessionResult = Awaited<ReturnType<typeof journey2.get>>;
type CatalogueResult = Awaited<ReturnType<typeof journey2.catalogue>>;
const PRIMED_SESSION_TTL_MS = 60_000;
const PRIMED_CATALOGUE_TTL_MS = 5 * 60_000;
let primedSession: { token: string; at: number; promise: Promise<SessionResult | null> } | null = null;
let primedCatalogue: { at: number; promise: Promise<CatalogueResult | null> } | null = null;

function primeCatalogue() {
  if (primedCatalogue && Date.now() - primedCatalogue.at < PRIMED_CATALOGUE_TTL_MS) return;
  primedCatalogue = { at: Date.now(), promise: journey2.catalogue().catch(() => null) };
}

function primeSession(token: string) {
  if (primedSession?.token === token && Date.now() - primedSession.at < PRIMED_SESSION_TTL_MS) return;
  primedSession = { token, at: Date.now(), promise: journey2.get(token).catch(() => null) };
}

/** The session for `token`, using the primed request when it is fresh and succeeded. */
export async function loadJourneySession(token: string): Promise<SessionResult> {
  const primed = primedSession;
  primedSession = null;
  if (primed && primed.token === token && Date.now() - primed.at < PRIMED_SESSION_TTL_MS) {
    const res = await primed.promise;
    if (res?.ok && res.session) return res;
  }
  return journey2.get(token);
}

/** The residential catalogue, using the primed request when it is fresh and succeeded. */
export async function loadJourneyCatalogue(): Promise<CatalogueResult> {
  const primed = primedCatalogue;
  if (primed && Date.now() - primed.at < PRIMED_CATALOGUE_TTL_MS) {
    const res = await primed.promise;
    if (res?.ok && res.catalogue) return res;
  }
  primedCatalogue = null;
  return journey2.catalogue();
}

/**
 * Starts the server-side order-session assignment in the background as soon as
 * the customer has selected an address, then primes the session and catalogue
 * the order page needs. This removes those network round-trips from the later
 * "Choose plan" click without creating sessions for casual homepage visitors.
 */
export function prewarmAssignedJourney(): void {
  void journeyCapabilities();
  primeCatalogue();
  void ensurePreparedStart()
    .then((res) => {
      if (res?.token) primeSession(res.token);
    })
    .catch(() => {
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
