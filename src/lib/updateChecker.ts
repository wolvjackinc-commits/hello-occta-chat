/**
 * Silent update checker.
 * Periodically fetches the entry HTML to see if a new deploy happened.
 * If so, reloads when safe (not during checkout/forms).
 */
import { BUILD_VERSION } from "./buildVersion";

const CHECK_INTERVAL_MS = 60_000; // every 60 s
const UNSAFE_PATHS = ["/checkout", "/business-checkout", "/pay", "/dd-setup", "/pay-invoice"];

let timer: ReturnType<typeof setInterval> | null = null;

function isUserInCriticalFlow(): boolean {
  const path = window.location.pathname;
  if (UNSAFE_PATHS.some((p) => path.startsWith(p))) return true;
  // Check for open modals / forms
  if (document.querySelector("form:focus-within, [role='dialog'][data-state='open']")) return true;
  return false;
}

async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch("/?_vc=" + Date.now(), {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    if (!res.ok) return;
    const html = await res.text();

    // Vite injects <script type="module" src="/assets/index-HASH.js">
    // If the HTML references a different hash than what we booted with, new deploy happened.
    const match = html.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
    if (!match) return;

    // Compare with current running script
    const currentScripts = document.querySelectorAll('script[src*="/assets/index-"]');
    const currentHash = Array.from(currentScripts)
      .map((s) => s.getAttribute("src")?.match(/index-([a-zA-Z0-9_-]+)\.js/)?.[1])
      .filter(Boolean)[0];

    if (currentHash && match[1] !== currentHash) {
      console.info(`[OCCTA] New deploy detected (${currentHash} → ${match[1]})`);
      scheduleReload();
    }
  } catch {
    // Network error — skip silently
  }
}

function scheduleReload(): void {
  // Stop checking
  if (timer) clearInterval(timer);
  timer = null;

  const tryReload = () => {
    if (isUserInCriticalFlow()) {
      // Retry in 10 s
      setTimeout(tryReload, 10_000);
      return;
    }
    // Safe to reload
    window.location.reload();
  };

  // If page is hidden, reload on next visibility
  if (document.hidden) {
    const onVisible = () => {
      document.removeEventListener("visibilitychange", onVisible);
      tryReload();
    };
    document.addEventListener("visibilitychange", onVisible);
  } else {
    tryReload();
  }
}

export function startUpdateChecker(): void {
  if (BUILD_VERSION === "dev") return; // skip in dev
  if (timer) return;

  // First check after 30 s, then every interval
  setTimeout(() => {
    checkForUpdate();
    timer = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
  }, 30_000);

  // Also check when tab becomes visible after being hidden
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkForUpdate();
  });
}
