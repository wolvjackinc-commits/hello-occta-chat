import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import About from "@/pages/About";
import ServiceStatus from "@/pages/ServiceStatus";
import FlexBroadband from "@/pages/broadband/Flex";
import ContractSaverBroadband from "@/pages/broadband/ContractSaver";
import ComplaintsCode from "@/pages/legal/ComplaintsCode";
import CodeOfPractice from "@/pages/legal/CodeOfPractice";
import VulnerableCustomers from "@/pages/legal/VulnerableCustomers";
import PriceTransparency from "@/pages/legal/PriceTransparency";
import SwitchingPolicy from "@/pages/legal/SwitchingPolicy";
import NetworkManagement from "@/pages/legal/NetworkManagement";
import AcceptableUse from "@/pages/legal/AcceptableUse";
import Accessibility from "@/pages/legal/Accessibility";
import ModernSlavery from "@/pages/legal/ModernSlavery";
import { CHARGED_PRICES } from "@/lib/pricing/chargedPrices";

class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
window.scrollTo = (() => {}) as typeof window.scrollTo;

// Every query fails, as it would before the status migration is applied.
const failing = () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "limit", "in", "maybeSingle", "single"]) chain[m] = () => chain;
  (chain as { then: unknown }).then = (res: (v: unknown) => void) => res({ data: null, error: { message: "relation does not exist" } });
  return chain;
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => failing(),
    rpc: () => Promise.resolve({ data: [], error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("@/components/layout/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/activityLog", () => ({ logClientEvent: () => {} }));
vi.mock("@/lib/journey2/route", () => ({ loadJourneyCatalogue: () => Promise.resolve(null) }));

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <HelmetProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </HelmetProvider>
  </QueryClientProvider>
);

describe("rewritten public pages", () => {
  it("About shows company facts and commitments", () => {
    render(wrap(<About />));
    expect(screen.getAllByText("13828933").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /our commitments/i })).toBeInTheDocument();
    expect(screen.queryByText(/drinking tea|your nan|give a toss/i)).toBeNull();
  });

  it("status page never claims all-clear when the feed can't be read", async () => {
    render(wrap(<ServiceStatus />));
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/all services operating normally/i)).toBeNull();
  });

  it("Flex 30 shows real prices", () => {
    render(wrap(<FlexBroadband />));
    expect(screen.getAllByText(`£${CHARGED_PRICES.superfast.flex30.toFixed(2)}`, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/rewards eligibility|Contract Saver/i)).toBeNull();
  });

  it("Price Lock 24 shows real prices and no 'launching soon'", () => {
    render(wrap(<ContractSaverBroadband />));
    expect(screen.getAllByText(`£${CHARGED_PRICES.gigabit.lock24.toFixed(2)}`, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/launching soon/i)).toBeNull();
  });

  it.each([
    ["Complaints Code", ComplaintsCode, /deadlock and adr/i],
    ["Code of Practice", CodeOfPractice, /billing and payment/i],
    ["Vulnerable Customers", VulnerableCustomers, /payment support/i],
    ["Price Transparency", PriceTransparency, /current residential broadband prices/i],
    ["Switching Policy", SwitchingPolicy, /keeping your phone number/i],
    ["Network Management", NetworkManagement, /open internet commitment/i],
    ["Acceptable Use", AcceptableUse, /how we enforce this policy/i],
    ["Accessibility", Accessibility, /reporting a problem/i],
    ["Modern Slavery", ModernSlavery, /reporting concerns/i],
  ])("%s renders its full content", (_name, Page, heading) => {
    render(wrap(<Page />));
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /policies/i })).toBeInTheDocument();
  });
});
