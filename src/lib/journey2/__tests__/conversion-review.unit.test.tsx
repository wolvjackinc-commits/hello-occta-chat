import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewStep from "@/pages/quote/journey/ReviewStep";
import OrderSummaryCard from "@/pages/order/steps/OrderSummaryCard";
import { supabase } from "@/integrations/supabase/client";
import type { Journey2Session } from "../client";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
const invoke = vi.mocked(supabase.functions.invoke);

const session = {
  price_snapshot: {
    monthly_total_incl_vat: 35,
    monthly_total_ex_vat: 29.17,
    vat_amount: 5.83,
    one_off_total_incl_vat: 60,
    plan_term: "price_lock_24",
    speed_bucket: "essential",
    router: { label: "Router", monthly: 5, oneOff: 60 },
    addons: [],
  },
} as unknown as Journey2Session;

beforeEach(() => vi.clearAllMocks());

it("shows full charges and uses the final button as consent while preserving idempotency on retry", async () => {
  const submitted = vi.fn();
  invoke.mockResolvedValueOnce({ data: { error: "temporary_failure" }, error: null });
  invoke.mockResolvedValueOnce({ data: { order: { order_number: "TEST" } }, error: null });

  render(
    <ReviewStep
      token="test-quote-token"
      quote={{ monthly_gross: 35 }}
      journey={{}}
      paymentMethod={{ method: "direct_debit", active: true }}
      onSubmitted={submitted}
      orderSummary={<OrderSummaryCard session={session} embedded />}
    />,
  );

  expect(screen.getByText("One-off total")).toBeVisible();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Submit my order" });
  expect(button).toBeEnabled();

  fireEvent.click(button);
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(submitted).not.toHaveBeenCalled();

  fireEvent.click(button);
  await waitFor(() => expect(submitted).toHaveBeenCalledOnce());
  expect(invoke.mock.calls[0][1]?.body).toEqual(invoke.mock.calls[1][1]?.body);
  expect(invoke.mock.calls[0][1]?.body).toMatchObject({ final_consent: true, token: "test-quote-token" });
});

it("does not enable submission without an active payment method", () => {
  const { rerender } = render(
    <ReviewStep token="test" quote={{}} journey={{}} paymentMethod={null} onSubmitted={vi.fn()} />,
  );
  expect(screen.getByRole("button", { name: "Submit my order" })).toBeDisabled();
  expect(invoke).not.toHaveBeenCalled();

  rerender(
    <ReviewStep
      token="test"
      quote={{}}
      journey={{}}
      paymentMethod={{ method: "direct_debit", active: false }}
      onSubmitted={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Submit my order" })).toBeDisabled();
  expect(invoke).not.toHaveBeenCalled();
});
