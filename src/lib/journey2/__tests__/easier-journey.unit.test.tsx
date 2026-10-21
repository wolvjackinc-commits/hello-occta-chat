import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import type { Catalogue, Journey2Session } from "../client";
import { planLabel, selectionDiffers, selectionTotals } from "../selection";
import AddressStep from "@/pages/order/steps/AddressStep";
import DateOfBirthInput from "@/components/order/DateOfBirthInput";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/components/address/AddressAutocomplete", () => ({
  default: ({ onSelect }: { onSelect: (address: unknown) => void }) => (
    <button type="button" onClick={() => onSelect({ line1: "10 Test Street", city: "London", postcode: "SW1A 1AA" })}>Select test address</button>
  ),
}));

const session = {
  id: "test", current_step: "address", service_address: null, customer_details: null, price_snapshot: null,
  speed_bucket: "superfast", plan_term: "price_lock_24", router_option: null, selected_addons: [],
} as unknown as Journey2Session;

const catalogue: Catalogue = {
  pricing_version: "test", customer_type: "residential", setup: { option: "remote", label: "Remote", one_off: 0 },
  plans: [
    { speed_bucket: "superfast", label: "Superfast Fibre", terms: { price_lock_24: { monthly_incl_vat: 43.99, monthly_ex_vat: 36.66, vat_amount: 7.33 } } },
    { speed_bucket: "ultrafast", label: "Ultrafast Fibre", terms: { price_lock_24: { monthly_incl_vat: 51.99, monthly_ex_vat: 43.33, vat_amount: 8.66 } } },
  ],
  routers: [
    { key: "own_none", option: "own", payment_type: "none", label: "Own", monthly: 0, one_off: 0 },
    { key: "standard_monthly", option: "standard", payment_type: "monthly", label: "WiFi 6", monthly: 4.99, one_off: 0 },
  ],
  extras: [{ id: "static_ip", label: "Static IP", monthly: 5 }],
};

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe("address step without an early contact gate", () => {
  it("lets the customer continue with no name or email when the server allows it", () => {
    const save = vi.fn();
    render(<MemoryRouter><AddressStep session={session} saving={false} onSave={save} contactOptional /></MemoryRouter>);
    fireEvent.click(screen.getByText("Select test address"));
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email address (optional)")).toBeVisible();
    fireEvent.click(screen.getByText("Save address and compare plans"));
    const payload = save.mock.calls[0][0];
    expect(payload).toMatchObject({ postcode: "SW1A 1AA", address_line_1: "10 Test Street" });
    expect(payload).not.toHaveProperty("contact_email");
    expect(payload).not.toHaveProperty("contact_full_name");
  });

  it("still sends an email the customer chose to give", () => {
    const save = vi.fn();
    render(<MemoryRouter><AddressStep session={session} saving={false} onSave={save} contactOptional /></MemoryRouter>);
    fireEvent.click(screen.getByText("Select test address"));
    fireEvent.change(screen.getByLabelText("Email address (optional)"), { target: { value: "Me@Example.com" } });
    fireEvent.click(screen.getByText("Save address and compare plans"));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ contact_email: "me@example.com" }));
  });
});

describe("live order summary", () => {
  it("prices an unsaved selection from the catalogue", () => {
    const totals = selectionTotals(catalogue, session, {
      speed_bucket: "ultrafast",
      router: { option: "standard", payment_type: "monthly" },
      addons: ["static_ip"],
    });
    expect(totals).toEqual({ planLabel: "Ultrafast Fibre", monthly: 61.98, oneOff: 0 });
    expect(selectionDiffers(totals, null, 0)).toBe(true);
  });

  it("names the plan, never the internal bucket id", () => {
    expect(planLabel({ speed_bucket: "superfast" } as never, catalogue)).toBe("Superfast Fibre");
    expect(planLabel({ speed_bucket: "gigabit" } as never, null)).toBe("Gigabit Fibre");
  });
});

describe("date of birth boxes", () => {
  const Harness = ({ onValue }: { onValue: (v: string) => void }) => {
    const [value, setValue] = useState("");
    return <DateOfBirthInput id="dob" value={value} onChange={(v) => { setValue(v); onValue(v); }} />;
  };

  it("reports an ISO date once day, month and year are filled", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "1988" } });
    expect(onValue).toHaveBeenLastCalledWith("1988-03-07");
  });

  it("uses the numeric keypad and birthday autofill", () => {
    render(<Harness onValue={vi.fn()} />);
    expect(screen.getByLabelText("Day")).toHaveAttribute("autocomplete", "bday-day");
    expect(screen.getByLabelText("Year")).toHaveAttribute("inputmode", "numeric");
  });
});
