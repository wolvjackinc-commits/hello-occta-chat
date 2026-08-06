/**
 * Guards the customer dashboard account-linking wiring.
 *
 * The live behaviour of `link_my_customer_account()` (auth requirement,
 * idempotency, cross-user isolation, empty accounts, masked Direct Debit) is
 * proven against the real database by the isolated
 * `dashboard-linker-selftest` edge function, which creates and deletes its own
 * throwaway users. These assertions stop the client from regressing back to the
 * old partial linker or losing the customer entry points.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("customer dashboard account linking wiring", () => {
  const auth = read("src/pages/Auth.tsx");
  const dashboard = read("src/pages/Dashboard.tsx");
  const header = read("src/components/layout/Header.tsx");
  const footer = read("src/components/layout/Footer.tsx");

  it("calls the canonical no-argument linker after sign-in", () => {
    expect(auth).toContain('rpc("link_my_customer_account")');
    expect(auth).not.toContain("link_quote_requests_to_user");
  });

  it("calls the canonical linker before loading the dashboard", () => {
    expect(dashboard).toContain('rpc("link_my_customer_account")');
    expect(dashboard).not.toContain("link_quote_requests_to_user");
  });

  it("never passes a browser-supplied identity to the linker", () => {
    for (const src of [auth, dashboard]) {
      expect(src).not.toMatch(/link_my_customer_account",\s*\{/);
    }
  });

  it("exposes a permanent My OCCTA entry point on desktop and mobile", () => {
    const matches = header.match(/\/auth\?claim=1&next=\/dashboard/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(header).toContain("My OCCTA");
  });

  it("exposes a customer account link in the footer", () => {
    expect(footer).toContain("My OCCTA");
  });

  it("redirects signed-out visitors instead of rendering a blank dashboard", () => {
    expect(dashboard).toContain('/auth?claim=1&next=/dashboard');
    expect(dashboard).toContain("get_my_customer_overview");
  });
});
