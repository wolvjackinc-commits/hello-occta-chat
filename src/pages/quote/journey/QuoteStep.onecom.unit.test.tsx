import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import QuoteStep from "./QuoteStep";

const onecomQuote = {
  quote_number: "QT-TEST-ONECOM",
  plan_name: "Essential Fibre Flex 30",
  service_type: "broadband",
  plan_type: "flex",
  customer_type: "residential",
  customer_name: "Customer",
  service_address: "29 The Serpentine South, Liverpool, L23 6UQ",
  contract_length_months: null,
  monthly_gross: 42.98,
  monthly_net: 35.82,
  router_option: { option: "standard", payment_type: "monthly", monthly: 4.99, oneOff: 0 },
  extra_line_items: [{ kind: "monthly", description: "OCCTA supplied compatible router — monthly rental", gross_amount: 4.99 }],
  setup_gross: 0,
  router_gross: 0,
  installation_gross: 0,
  total_due_today_gross: 0,
  cease_fee_gross: 114,
  notice_period: "30 days",
  estimated_download_speed: 80,
  estimated_upload_speed: 20,
  likely_service_date: "2026-11-16",
  customer_notes: "Customer expects to move to 1 Merrilocks Green; second installation quoted separately.",
  selected_addons: [],
  expires_at: "2026-12-01T00:00:00Z",
  status: "sent",
};

describe("Onecom personalised rolling broadband quote", () => {
  it("discloses monthly router rental and conditional cease fee before acceptance", () => {
    render(
      <MemoryRouter>
        <QuoteStep quote={onecomQuote} journey={null} continuing={false} declining={false}
          onContinue={vi.fn()} onDeclineClick={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("£42.98")).toBeVisible();
    expect(screen.getByText("£37.99")).toBeVisible();
    expect(screen.getByText("£4.99/mo")).toBeVisible();
    expect(screen.getByText(/up to £114.00 including VAT in the first 12 months/)).toBeVisible();
    expect(screen.getByText(/up to £60.00 thereafter/)).toBeVisible();
    expect(screen.getByText(/Customer expects to move to 1 Merrilocks Green/)).toBeVisible();
    expect(screen.getByText(/Nothing is charged today/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Continue with this quote/i })).toBeEnabled();
  });
});
