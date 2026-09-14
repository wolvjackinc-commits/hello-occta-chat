import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { comparisonTerm, oneOffTotal, planSavings } from "../conversion";
import type { Catalogue, Journey2Session, PriceSnapshot } from "../client";
import AddressStep from "@/pages/order/steps/AddressStep";
import PlanStep from "@/pages/order/steps/PlanStep";
import RouterStep from "@/pages/order/steps/RouterStep";
import ExtrasStep from "@/pages/order/steps/ExtrasStep";
import MobileOrderTotal from "@/pages/order/steps/MobileOrderTotal";
import JourneyRecovery from "@/pages/order/steps/JourneyRecovery";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/components/address/AddressAutocomplete", () => ({ default: ({ onSelect }: { onSelect: (address: unknown) => void }) => <button type="button" onClick={() => onSelect({ line1: "10 Test Street", city: "London", postcode: "SW1A 1AA" })}>Select test address</button> }));

const price = { monthly_total_incl_vat: 32, monthly_total_ex_vat: 26.67, vat_amount: 5.33, one_off_total_incl_vat: 40, plan_term: "price_lock_24", speed_bucket: "essential", router: { monthly: 2, oneOff: 10 } } as PriceSnapshot;
const session = { id: "test", current_step: "address", service_address: null, customer_details: null, price_snapshot: price, plan_term: "price_lock_24", selected_addons: [] } as unknown as Journey2Session;
const catalogue: Catalogue = {
  pricing_version: "test", customer_type: "residential", setup: { option: "setup", label: "Setup", one_off: 30 },
  plans: [{ speed_bucket: "essential", label: "Essential", terms: { price_lock_24: { monthly_incl_vat: 30, monthly_ex_vat: 25, vat_amount: 5 }, flex_30: { monthly_incl_vat: 35, monthly_ex_vat: 29.17, vat_amount: 5.83 } } }],
  routers: [{ key: "own_none", option: "own", payment_type: "none", label: "Own", monthly: 0, one_off: 0 }, { key: "standard_monthly", option: "standard", payment_type: "monthly", label: "WiFi 6", monthly: 2, one_off: 0 }, { key: "standard_one_off", option: "standard", payment_type: "one_off", label: "WiFi 6", monthly: 0, one_off: 50 }],
  extras: [{ id: "digital_voice", label: "Digital Voice", monthly: 5 }],
};

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe("conversion-critical checkout", () => {
  it("shows address first, retains contact and legal gates, and submits normalized details", () => {
    const save = vi.fn();
    render(<MemoryRouter><AddressStep session={session} saving={false} onSave={save} /></MemoryRouter>);
    expect(screen.getByLabelText("Installation postcode")).toBeVisible();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Select test address"));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " Test Customer " } });
    const email = screen.getByLabelText("Email address");
    fireEvent.change(email, { target: { value: "bad" } }); fireEvent.blur(email);
    expect(email).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(email, { target: { value: "TEST@example.com" } }); fireEvent.blur(email);
    fireEvent.click(screen.getByText("Save address and compare plans"));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Save address and compare plans"));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ postcode: "SW1A 1AA", contact_email: "test@example.com", contact_full_name: "Test Customer" }));
  });

  it("compares the selected term instead of advertising the cheapest term", () => {
    const save = vi.fn();
    render(<PlanStep catalogue={catalogue} session={{ ...session, plan_term: "flex_30" }} saving={false} onSave={save} onBack={vi.fn()} />);
    const speed = screen.getByRole("group", { name: "Speed" });
    expect(within(speed).getByText("£35.00")).toBeVisible();
    expect(within(speed).queryByText("£30.00")).not.toBeInTheDocument();
    expect(screen.getByText(/Setup: £30.00 one-off/)).toBeVisible();
    expect(screen.getByText(/today’s Flex 30 price/)).toBeVisible();
    fireEvent.click(screen.getByText("Choose router for this plan"));
    expect(save).toHaveBeenCalledWith({ speed_bucket: "essential", plan_term: "flex_30" });
  });

  it("preserves Flex router eligibility and replaces previous router charges in the preview", () => {
    render(<RouterStep catalogue={catalogue} session={{ ...session, plan_term: "flex_30" }} saving={false} onSave={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByText("Standard WiFi 6 router — monthly")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Standard WiFi 6 router — one-off"));
    expect(screen.getByText("With this router: £30.00/month")).toBeVisible();
    expect(screen.getByText(/£80.00 one-off in total/)).toBeVisible();
  });

  it("never skips the Digital Voice acknowledgement", () => {
    const save = vi.fn();
    render(<ExtrasStep catalogue={catalogue} session={session} saving={false} onSave={save} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("Digital Voice"));
    fireEvent.click(screen.getByText("Continue with extras"));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("emergency calls");
    fireEvent.click(screen.getByLabelText("I've read and understood how Digital Voice and emergency calls work."));
    fireEvent.click(screen.getByText("Continue with extras"));
    expect(save).toHaveBeenCalledWith({ addons: ["digital_voice"], digital_voice_acknowledged: true });
  });

  it("uses authoritative totals even when line items differ", () => {
    render(<MobileOrderTotal session={session} />);
    expect(screen.getByText("£40.00 one-off")).toBeVisible();
    expect(screen.getByText("£32.00/month")).toBeVisible();
    expect(oneOffTotal({ ...price, one_off_total_incl_vat: 0 })).toBe(0);
  });

  it("offers recovery when clipboard access fails without claiming unsaved fields are saved", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<JourneyRecovery expiresAt="2026-10-14T12:00:00Z" />);
    fireEvent.click(screen.getByText("Need to finish later?"));
    fireEvent.click(screen.getByText("Copy my private order link"));
    expect(await screen.findByText(/Copy this page's address/)).toBeInTheDocument();
    expect(screen.getByText(/Entries on the current step/)).toBeInTheDocument();
  });

  it("handles missing terms and computes savings in pennies", () => {
    expect(comparisonTerm({ ...catalogue.plans[0], terms: {} }, "flex_30")).toBeUndefined();
    expect(planSavings(30.01, 30)).toEqual({ monthly: 0.01, over24Months: 0.24 });
    expect(planSavings(30, 30)).toBeNull();
    expect(planSavings(undefined, 30)).toBeNull();
  });
});
