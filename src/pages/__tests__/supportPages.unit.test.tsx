import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Support from "@/pages/Support";
import HelpCenter from "@/pages/help/HelpCenter";
import HelpArticlePage from "@/pages/help/HelpArticle";
import { helpArticles } from "@/data/helpArticles";

class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
window.scrollTo = (() => {}) as typeof window.scrollTo;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("@/components/layout/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/useAppMode", () => ({ useAppMode: () => ({ isAppMode: false }) }));

const wrap = (ui: React.ReactNode, path = "/") => (
  <HelmetProvider>
    <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
  </HelmetProvider>
);

describe("support pages render", () => {
  it("support hub shows topics, contact channels and status", () => {
    render(wrap(<Support />));
    expect(screen.getByText(/how can we/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /browse by topic/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /contact us/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /service status/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/emergency\? call 999/i)).toBeInTheDocument();
  });

  it("help centre lists every category", () => {
    render(wrap(<HelpCenter />, "/help"));
    expect(screen.getAllByRole("heading", { level: 2, name: /mobile & sim/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { level: 2, name: /complaints & your rights/i }).length).toBeGreaterThan(0);
  });

  it.each(helpArticles.map((a) => a.slug))("article %s renders", (slug) => {
    const a = helpArticles.find((x) => x.slug === slug)!;
    render(
      wrap(
        <Routes>
          <Route path="/help/:slug" element={<HelpArticlePage />} />
        </Routes>,
        `/help/${slug}`,
      ),
    );
    expect(screen.getAllByText(a.title).length).toBeGreaterThan(0);
  });
});
