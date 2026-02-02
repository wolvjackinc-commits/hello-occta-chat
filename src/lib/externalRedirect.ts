/**
 * Redirect to an external URL.
 *
 * In the editor preview, the app runs inside an iframe; some payment/3DS flows
 * (Worldpay HPP/Cardinal) can fail when nested in iframes due to postMessage
 * origin restrictions. Breaking out to the top window avoids that.
 */
export function redirectToExternal(url: string) {
  if (typeof window === "undefined") return;

  // In embedded preview iframes, accessing window.top can throw (cross-origin).
  // Using window.open(url, "_top") reliably navigates the top-level browsing
  // context without needing to touch window.top.
  try {
    window.open(url, "_top");
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
