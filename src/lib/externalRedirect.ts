/**
 * Redirect to an external URL.
 *
 * In the editor preview, the app runs inside an iframe; some payment/3DS flows
 * (Worldpay HPP/Cardinal) can fail when nested in iframes due to postMessage
 * origin restrictions. Breaking out to the top window avoids that.
 */
export function redirectToExternal(url: string) {
  try {
    // If we're inside an iframe (e.g., editor preview), escape to top.
    if (typeof window !== "undefined" && window.self !== window.top && window.top) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // Accessing window.top can throw due to cross-origin policies.
    // Fall back to same-window navigation.
  }

  window.location.href = url;
}
