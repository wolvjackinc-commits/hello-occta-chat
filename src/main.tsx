import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startUpdateChecker } from "./lib/updateChecker";

// ── Service-worker cleanup: remove stale app-shell caches so returning visitors get the newest deploy ──
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const unregisterStaleAppShellServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((registration) => {
        const scriptUrl =
          registration.active?.scriptURL ||
          registration.waiting?.scriptURL ||
          registration.installing?.scriptURL ||
          "";

        if (scriptUrl.endsWith("/sw.js") || isPreviewHost || isInIframe) {
          registration.unregister();
        }
      });
    });

    window.caches?.keys().then((cacheNames) => {
      cacheNames
        .filter((name) => /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name))
        .forEach((name) => window.caches.delete(name));
    });
  });
};

if (isPreviewHost || isInIframe || window.location.hostname.endsWith("occta.co.uk")) {
  unregisterStaleAppShellServiceWorker();
}

// ── Render ──
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ── Start silent update checker (production only) ──
startUpdateChecker();
