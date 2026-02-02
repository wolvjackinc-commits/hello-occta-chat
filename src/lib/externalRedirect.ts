/**
 * Redirect to an external URL.
 *
 * In the editor preview, the app runs inside an iframe; some payment/3DS flows
 * (Worldpay HPP/Cardinal) can fail when nested in iframes due to postMessage
 * origin restrictions. Breaking out to the top window avoids that.
 */
export function redirectToExternal(url: string) {
  if (typeof window === "undefined") return;

  const host = window.location.hostname;
  const isPreviewHost = host.startsWith("id-preview--");

  // In embedded preview iframes, accessing window.top can throw (cross-origin).
  // Also, 3DS/postMessage flows can break inside the Lovable preview iframe.
  // Opening a new tab from a user click is the most reliable escape hatch.
  try {
    if (isPreviewHost) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.open(url, "_top");
    }
    return;
  } catch {
    // ignore
  }

  // Fallbacks
  try {
    window.location.assign(url);
  } catch {
    window.location.href = url;
  }
}
