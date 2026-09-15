/**
 * Production guards for the customer dashboard (desktop + app mode).
 *
 * Behaviour-level assertions cover the real pending-quote counting, UK
 * date/currency formatting and per-user cache isolation. Source-level
 * assertions cover wiring that cannot regress silently: app mode must not run
 * its own auth listener, must receive real tickets, and every desktop deep link
 * must land on a rendered app-mode section.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { countOpenQuoteWork, EMPTY_QUOTE_COUNTS } from "@/lib/dashboard/quoteCounts";
import { formatGbp, formatUkDate } from "@/lib/dashboard/format";
import { readCache, writeCache, clearUserCache } from "@/lib/offlineCache";

const read = (p: string) => readFileSync(p, "utf8");
const dashboard = read("src/pages/Dashboard.tsx");
const appDashboard = read("src/components/app/AppDashboard.tsx");

/** Extract the quoted keys of an object literal that starts at `anchor`. */
function objectKeysAfter(src: string, anchor: string): string[] {
  const start = src.indexOf(anchor);
  expect(start, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf("\n  };", start) > -1 ? src.indexOf("\n  };", start) : start + 4000);
  return Array.from(body.matchAll(/^\s{4}"?([A-Za-z][A-Za-z0-9_]*)"?:/gm)).map((m) => m[1]);
}

describe("open quote counting", () => {
  it("counts nothing when the customer owns no quote work", () => {
    expect(countOpenQuoteWork([], [])).toEqual(EMPTY_QUOTE_COUNTS);
    expect(countOpenQuoteWork(null, undefined)).toEqual(EMPTY_QUOTE_COUNTS);
  });

  it("counts only actionable quotes and live quote requests", () => {
    const counts = countOpenQuoteWork(
      [
        { status: "sent" },
        { status: "viewed" },
        { status: "approved" },
        { status: "expired" },
        { status: "draft" },
        { status: "approved", customer_intent_proceeded_at: "2026-09-01T10:00:00Z" },
      ],
      [{ status: "new" }, { status: "needs_info" }, { status: "converted" }, { status: "closed" }],
    );
    expect(counts.openQuotes).toBe(3);
    expect(counts.openRequests).toBe(2);
    expect(counts.total).toBe(5);
  });

  it("is wired into the overview instead of a hard-coded zero", () => {
    expect(dashboard).not.toContain("pendingQuotes={0}");
    expect(dashboard).toContain("pendingQuotes={quoteCounts.total}");
    expect(dashboard).toContain('rpc("get_customer_quotes")');
    expect(dashboard).toContain('rpc("get_customer_quote_requests")');
  });
});

describe("UK formatting", () => {
  it("formats valid dates and rejects invalid ones without printing Invalid Date", () => {
    expect(formatUkDate("2026-09-23T00:00:00Z")).toBe("23 Sep 2026");
    expect(formatUkDate("2026-09-23")).toBe("23 Sep 2026");
    expect(formatUkDate("not-a-date")).toBeNull();
    expect(formatUkDate(null)).toBeNull();
  });

  it("never renders NaN amounts", () => {
    expect(formatGbp(34.99)).toBe("£34.99");
    expect(formatGbp("208.75")).toBe("£208.75");
    expect(formatGbp(null)).toBe("£0.00");
    expect(formatGbp("abc")).toBe("£0.00");
  });
});

describe("offline cache user isolation", () => {
  beforeEach(() => window.localStorage.clear());

  it("never returns one user's cached data to another user", () => {
    writeCache("user-a", "dashboard.orders", [{ id: "a" }]);
    expect(readCache("user-b", "dashboard.orders")).toBeNull();
    expect(readCache(null, "dashboard.orders")).toBeNull();
    expect(readCache("user-a", "dashboard.orders")).toEqual([{ id: "a" }]);
  });

  it("clears a signed-out user's cache without touching other users", () => {
    writeCache("user-a", "dashboard.orders", [{ id: "a" }]);
    writeCache("user-b", "dashboard.orders", [{ id: "b" }]);
    clearUserCache("user-a");
    expect(readCache("user-a", "dashboard.orders")).toBeNull();
    expect(readCache("user-b", "dashboard.orders")).toEqual([{ id: "b" }]);
  });

  it("is cleared on dashboard sign-out", () => {
    expect(dashboard).toContain("clearUserCache");
  });
});

describe("app-mode dashboard", () => {
  it("does not run a second auth listener or its own redirect", () => {
    expect(appDashboard).not.toContain("onAuthStateChange");
    expect(appDashboard).not.toContain("auth.getSession()");
    expect(appDashboard).toContain("user: User");
  });

  it("loads the real ticket list with a user id for read/unread state", () => {
    expect(appDashboard).not.toContain("tickets={[] as any}");
    expect(appDashboard).toContain("<SupportTab tickets={tickets as any} userId={userId} />");
  });

  it("initialises cached state per authenticated user only", () => {
    expect(appDashboard).not.toMatch(/readCache<[^>]*>\(\s*null\s*,/);
    expect(appDashboard).toContain('readCache<Order[]>(uid, "dashboard.orders")');
  });

  it("uses the canonical overview rather than order rows for service state", () => {
    expect(appDashboard).toContain("overview?.service");
    expect(appDashboard).toContain("overview?.direct_debit");
    expect(appDashboard).toContain("account_number");
  });

  it("shows a section-level error with retry instead of an empty account", () => {
    expect(appDashboard).toContain('role="alert"');
    expect(appDashboard).toContain("onRetry");
  });
});

describe("dashboard deep links", () => {
  const desktopTabs = objectKeysAfter(dashboard, "const TAB_PARENT:");
  const appSections = objectKeysAfter(appDashboard, "const sectionTitle:");

  it("maps a meaningful set of desktop tabs", () => {
    expect(desktopTabs.length).toBeGreaterThan(10);
  });

  it("renders every desktop ?tab= value in app mode too", () => {
    const appModeHandled = new Set([...appSections, "overview", "order-service", "home"]);
    const missing = desktopTabs.filter((t) => !appModeHandled.has(t));
    expect(missing, `app mode has no section for: ${missing.join(", ")}`).toEqual([]);
  });

  it("never leaves a dead rewards link when the feature is disabled", () => {
    // Both surfaces gate the rewards entry point on the same flag, so a
    // disabled build has no rewards tab, no menu row and no blank section.
    expect(dashboard).toContain("REWARDS_TAB_ENABLED ? { rewards:");
    expect(appDashboard).toContain("REWARDS_ENABLED ? { rewards:");
    expect(appDashboard).toContain("REWARDS_ENABLED\n");
  });

  it("keeps app-mode-only deep links working on desktop", () => {
    for (const tab of ["notifications", "privacy", "settings"]) {
      expect(desktopTabs).toContain(tab);
    }
  });

  it("falls back to the account home for unknown app-mode tabs", () => {
    expect(appDashboard).toContain('sectionTitle[requestedSection] ? requestedSection : "home"');
  });
});

describe("customer data access safety", () => {
  it("keeps using security_invoker customer views and no-argument RPCs", () => {
    expect(dashboard).toContain('rpc("get_my_customer_overview")');
    expect(dashboard).toContain('from("customer_profile"');
    expect(appDashboard).toContain('from("customer_orders"');
    expect(appDashboard).toContain('from("customer_contract_summaries"');
    // No browser-supplied identity may be passed to the SECURITY DEFINER RPCs.
    for (const src of [dashboard, appDashboard]) {
      expect(src).not.toMatch(/rpc\("get_my_customer_overview",\s*\{/);
      expect(src).not.toMatch(/rpc\("get_customer_quotes",\s*\{/);
    }
  });

  it("never queries supplier or wholesale references from the customer app", () => {
    for (const src of [dashboard, appDashboard]) {
      expect(src).not.toMatch(/from\("supplier_/);
      expect(src).not.toMatch(/wholesale/i);
    }
  });
});
