import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { Catalogue, Journey2Session } from "../client";
import PlanStep from "@/pages/order/steps/PlanStep";
import { isPermanentSendFailure, reminderOrderSummary, REMINDER_PHONE_LINE } from "../../../../supabase/functions/_shared/checkoutReminderCopy";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const session = {
  id: "s", current_step: "plan", service_address: { postcode: "HD3 3WU" }, customer_details: null, price_snapshot: null,
  speed_bucket: "essential", plan_term: "price_lock_24", router_option: null, selected_addons: [],
} as unknown as Journey2Session;

const catalogue: Catalogue = {
  pricing_version: "t", customer_type: "residential",
  // Older catalogues carried only the first term's setup (Price Lock 24's £0).
  setup: { option: "remote", label: "Remote / no-site activation", one_off: 0 },
  plans: [{
    speed_bucket: "essential", label: "Essential Fibre",
    terms: {
      price_lock_24: { monthly_incl_vat: 34.99, monthly_ex_vat: 29.16, vat_amount: 5.83, setup_one_off: 0, setup_label: "Remote / no-site activation" },
      flex_30: { monthly_incl_vat: 37.99, monthly_ex_vat: 31.66, vat_amount: 6.33, setup_one_off: 84.99, setup_label: "Network activation / remote setup" },
    },
  }],
  routers: [], extras: [],
};

describe("plan step setup charge", () => {
  it("shows Flex 30's own setup charge instead of Price Lock's £0", () => {
    const { container } = render(<PlanStep catalogue={catalogue} session={session} saving={false} onSave={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText("No setup charge")).toBeTruthy();
    expect(screen.getByText(/\+ £84\.99 one-off setup/)).toBeTruthy();
    expect(screen.getByText(/no-site activation: no setup charge/)).toBeTruthy();

    const terms = container.querySelectorAll<HTMLInputElement>('input[name="j2-term"]');
    expect(terms).toHaveLength(2);
    fireEvent.click(terms[1]); // price_lock_24, flex_30
    expect(screen.getByText("Network activation / remote setup: £84.99 one-off.")).toBeTruthy();
    expect(screen.queryByText(/no-site activation: no setup charge/)).toBeNull();
  });

  it("falls back to the catalogue setup when a term has none (older catalogue)", () => {
    const old = structuredClone(catalogue);
    delete old.plans[0].terms.price_lock_24!.setup_one_off;
    delete old.plans[0].terms.flex_30!.setup_one_off;
    render(<PlanStep catalogue={old} session={session} saving={false} onSave={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/no-site activation: no setup charge/)).toBeTruthy();
    expect(screen.queryByText(/one-off setup/)).toBeNull();
  });
});

describe("reminder email helpers", () => {
  it("summarises the saved order and escapes customer text", () => {
    const html = reminderOrderSummary({ planLabel: "Essential Fibre", planTerm: "flex_30", monthlyInclVat: 37.99, postcode: "hd3 <3wu>" });
    expect(html).toContain("Essential Fibre · Flex 30");
    expect(html).toContain("£37.99 a month including VAT");
    expect(html).toContain("HD3 &lt;3WU&gt;");
    expect(reminderOrderSummary({})).toBe("");
    // No price without a plan: never quote a figure we can't name.
    expect(reminderOrderSummary({ monthlyInclVat: 30 })).toBe("");
  });

  it("offers the phone without any card or phone-payment wording", () => {
    expect(REMINDER_PHONE_LINE).toContain("0800 260 6626");
    expect(REMINDER_PHONE_LINE).not.toMatch(/card|pay/i);
  });

  it("treats provider rejections as permanent but retries rate limits and outages", () => {
    expect(isPermanentSendFailure('resend_422: {"message":"Invalid `to` field"}')).toBe(true);
    expect(isPermanentSendFailure("resend_400: bad")).toBe(true);
    expect(isPermanentSendFailure("resend_429: slow down")).toBe(false);
    expect(isPermanentSendFailure("resend_500: oops")).toBe(false);
    expect(isPermanentSendFailure("network_error")).toBe(false);
    expect(isPermanentSendFailure(undefined)).toBe(false);
  });

  it("reminder worker keeps old links and closes permanently failing sequences", () => {
    const src = readFileSync("supabase/functions/journey2-resume-email/index.ts", "utf8");
    expect(src).toMatch(/customer_journey_token_aliases[\s\S]{0,200}previousHash/);
    expect(src).toMatch(/permanent[\s\S]{0,120}reminder_count: MAX_REMINDERS/);
    const session = readFileSync("supabase/functions/journey2-session/index.ts", "utf8");
    expect(session).toContain('from("customer_journey_token_aliases")');
    expect(session).toMatch(/reissuedToken \? \{ token: reissuedToken \}/);
  });
});

describe("order complete celebration", () => {
  it("shows Ollie with term-accurate reassurance", async () => {
    const { default: OllieCelebration } = await import("@/components/order/OllieCelebration");
    render(<OllieCelebration firstName="Pihu" planTerm="price_lock_24" coolingOffEndsAt="2026-11-19T00:00:00Z" />);
    expect(screen.getByLabelText("Ollie celebrating")).toBeTruthy();
    expect(screen.getByText("Brilliant choice, Pihu.")).toBeTruthy();
    expect(screen.getByText(/fixed for the full 24 months/)).toBeTruthy();
    expect(screen.getByText(/cancel free of charge until 19 November/)).toBeTruthy();
    expect(screen.queryByText(/30 days' notice/)).toBeNull();
  });
});

describe("free activation offer display", () => {
  it("crosses out the normal activation charge on the plan step", () => {
    const offer = structuredClone(catalogue);
    offer.plans[0].terms.flex_30 = { ...offer.plans[0].terms.flex_30!, setup_one_off: 0, setup_was_one_off: 84.99 };
    const { container } = render(<PlanStep catalogue={offer} session={{ ...session, plan_term: "flex_30" } as Journey2Session} saving={false} onSave={vi.fn()} onBack={vi.fn()} />);
    expect(container.querySelectorAll("s")[0]?.textContent).toBe("£84.99");
    expect(screen.getAllByText("FREE").length).toBeGreaterThan(0);
    expect(screen.getByText(/you save £84\.99/)).toBeTruthy();
    expect(screen.getByText(/advanced installation, that may be chargeable/)).toBeTruthy();
  });
});
