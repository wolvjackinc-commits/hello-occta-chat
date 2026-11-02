import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getSession = vi.fn();

vi.mock("@/components/layout/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/seo", () => ({ SEO: () => null, StructuredData: () => null, createFAQSchema: () => ({}) }));
vi.mock("@/lib/activityLog", () => ({ logClientEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { getSession: () => getSession() },
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://x" }, error: null }) }) },
  },
}));
vi.mock("framer-motion", () => {
  const strip = (tag: string) => ({ children, initial: _i, animate: _a, transition: _t, variants: _v, whileInView: _w, viewport: _vp, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
    const Tag = tag as "div"; return <Tag {...(props as object)}>{children}</Tag>;
  };
  return { MotionConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>, motion: new Proxy({}, { get: (_t, tag: string) => strip(tag) }) };
});

const catalogue = { sales_open: true, terms_version: "care-2026-11-v1", terms_summary: "x", support_hours: "x", plans: [] };

beforeEach(() => {
  rpc.mockReset();
  getSession.mockReset();
  rpc.mockImplementation(async (fn: string) => (fn === "care_public_catalogue" ? { data: catalogue, error: null } : { data: null, error: null }));
});

describe("OCCTA Care public pages", () => {
  it("landing page shows both plans, prices, and says plainly it is not insurance", async () => {
    const { default: CareLanding } = await import("../CareLanding");
    render(<MemoryRouter><CareLanding /></MemoryRouter>);
    expect(screen.getAllByText(/Care Essentials/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Care Plus/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/£4\.99/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Care is a support service, not insurance/)).toBeInTheDocument();
    expect(screen.getByTestId("care-not-included")).toHaveTextContent(/does not pay for, repair or replace/);
    fireEvent.click(screen.getByRole("radio", { name: /Yearly/ }));
    expect(screen.getAllByText(/£49\.90/).length).toBeGreaterThan(0);
  });

  it("key facts page lists every price", async () => {
    const { CareKeyFactsPage } = await import("../CareInfoPages");
    render(<MemoryRouter><CareKeyFactsPage /></MemoryRouter>);
    for (const p of ["£4.99", "£14.97", "£49.90", "£8.99", "£26.97", "£89.90"]) expect(screen.getAllByText(p).length).toBeGreaterThan(0);
  });

  it("join page asks signed-out visitors to sign in and comes back afterwards", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { default: CareJoin } = await import("../CareJoin");
    render(<MemoryRouter initialEntries={["/care/join?plan=plus"]}><CareJoin /></MemoryRouter>);
    const link = await screen.findByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toContain("/auth?next=");
  });

  it("join page explains why someone can't join", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u" } } } });
    rpc.mockImplementation(async (fn: string) => fn === "care_my_overview"
      ? { data: { signed_in: true, eligibility: { eligible: false, reasons: ["overdue_bill"], review: [] }, subscription: null }, error: null }
      : { data: catalogue, error: null });
    const { default: CareJoin } = await import("../CareJoin");
    render(<MemoryRouter initialEntries={["/care/join"]}><CareJoin /></MemoryRouter>);
    expect(await screen.findByTestId("care-not-eligible")).toHaveTextContent(/overdue OCCTA bill/);
  });
});

describe("My OCCTA → Care", () => {
  const member = {
    signed_in: true,
    eligibility: { eligible: false, reasons: ["already_member"], review: [] },
    subscription: {
      id: "s1", reference: "OCCTA CARE-100001", plan_code: "essentials", frequency: "monthly", price_minor: 499, collection_day: 1, status: "active",
      joined_at: "2026-11-02T10:00:00Z", cooling_off_ends_at: "2026-11-16T10:00:00Z", service_starts_on: "2026-11-16", first_collection_date: "2026-12-01",
      cancel_effective_date: null, cancelled_at: null, terms_version: "care-2026-11-v1",
      mandate: { status: "active", last4: "1234", sort_last2: "56", bank_name: null, holder: "Mrs Test" },
    },
    next_payment: { due_date: "2026-12-01", amount_minor: 499 },
    payments: [{ due_date: "2026-12-01", amount_minor: 499, period_start: "2026-12-01", period_end: "2026-12-31", status: "scheduled" }],
    letters: [{ id: "l1", type: "welcome_pack", created_at: "2026-11-02T10:00:00Z", pdf_path: "letters/u/l1.pdf", posted_on: null }],
    usage: [], requests: [], refunds: [], support_needs: null,
  };

  it("shows the plan, next payment and letters, and cancels in two clicks", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "care_my_overview") return { data: member, error: null };
      if (fn === "care_my_cancel") return { data: { ok: true, status: "cancel_pending", effective_date: "2026-12-31", refund_minor: 0 }, error: null };
      return { data: null, error: null };
    });
    const { default: CareTab } = await import("@/components/dashboard/tabs/CareTab");
    render(<MemoryRouter><CareTab /></MemoryRouter>);
    expect(await screen.findByTestId("care-tab-member")).toHaveTextContent("OCCTA CARE-100001");
    expect(screen.getByText(/£4\.99 on or just after/)).toBeInTheDocument();
    expect(screen.getByText(/Welcome pack/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("care-cancel"));
    fireEvent.click(await screen.findByTestId("care-cancel-confirm"));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("care_my_cancel", { p_reason: null }));
  });
});
