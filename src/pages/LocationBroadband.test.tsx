import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LocationBroadband from "./LocationBroadband";

vi.mock("@/components/layout/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/seo", () => ({
  SEO: () => null,
  StructuredData: () => null,
  createFAQSchema: () => ({}),
  createBreadcrumbSchema: () => ({}),
  createServiceSchema: () => ({}),
  createOfferSchema: () => ({}),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { addresses: [] },
        error: null,
      }),
    },
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      variants: _variants,
      whileInView: _whileInView,
      viewport: _viewport,
      whileHover: _whileHover,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/lib/plans", () => ({
  broadbandPlans: [
    {
      id: "broadband-essential",
      name: "Essential",
      price: "34.99",
      speed: "100",
      features: ["Unlimited data"],
      popular: true,
    },
  ],
}));

vi.mock("@/lib/pricing/engine", () => ({
  getFromPrices: () => ({ broadband: "34.99" }),
}));

vi.mock("@/pages/NotFound", () => ({
  default: () => <div>Page not found</div>,
}));

function renderCity(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationBroadband />
    </MemoryRouter>,
  );
}

describe("LocationBroadband", () => {
  it("renders the London page with the availability checker", () => {
    expect(() => renderCity("/broadband-london")).not.toThrow();

    expect(screen.getByText("BROADBAND IN")).toBeInTheDocument();
    expect(screen.getByText("LONDON")).toBeInTheDocument();
    expect(screen.getByText("Check Availability")).toBeInTheDocument();
  });

  it("renders the Manchester page with the availability checker", () => {
    expect(() => renderCity("/broadband-manchester")).not.toThrow();

    expect(screen.getByText("BROADBAND IN")).toBeInTheDocument();
    expect(screen.getByText("MANCHESTER")).toBeInTheDocument();
    expect(screen.getByText("Check Availability")).toBeInTheDocument();
  });

  it("renders the not-found state for an unknown city", () => {
    renderCity("/broadband-not-a-city");

    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});