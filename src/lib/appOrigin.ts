/**
 * Returns the origin that should be used for external payment providers.
 *
 * Worldpay (and its 3DS/cardinal step-up flow) can reject/throw errors when the
 * merchant return URL uses ephemeral preview origins.
 */

const PUBLISHED_ORIGIN_FALLBACK = "https://hello-occta-chat.lovable.app";

export function getPaymentReturnOrigin(): string {
  if (typeof window === "undefined") return PUBLISHED_ORIGIN_FALLBACK;

  const host = window.location.hostname;

  // Lovable preview domains are ephemeral and can break 3DS postMessage/origin checks.
  const isPreviewHost = host.startsWith("id-preview--");
  const isLocalhost = host === "localhost" || host === "127.0.0.1";

  if (isPreviewHost || isLocalhost) {
    return PUBLISHED_ORIGIN_FALLBACK;
  }

  return window.location.origin;
}
