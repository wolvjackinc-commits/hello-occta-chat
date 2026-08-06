import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { journey2 } from "../client";
import { startAssignedJourney } from "../route";

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe("Journey 2 integration", () => {
  beforeEach(() => invoke.mockReset());

  it("routes a v2-assigned visitor into the ordering flow", async () => {
    invoke.mockResolvedValue({ data: { ok: true, journey_version: "v2", token: "t".repeat(32) }, error: null });
    const navigate = vi.fn();
    await startAssignedJourney(navigate);
    expect(navigate).toHaveBeenCalledWith(`/order/${"t".repeat(32)}`);
  });

  it("saves steps in the required ten-step order", async () => {
    const order = ["address", "plan", "router", "extras", "details", "start_date", "billing"] as const;
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    for (const step of order) await journey2.saveStep("t".repeat(32), step, {});
    const steps = invoke.mock.calls.map((c) => (c[1] as any).body.step);
    expect(steps).toEqual([...order]);
  });

  it("submits with explicit final consent", async () => {
    invoke.mockResolvedValue({ data: { ok: true, order_number: "OCC-1" }, error: null });
    await journey2.submit("t".repeat(32));
    expect((invoke.mock.calls[0][1] as any).body).toMatchObject({ final_consent: true });
  });
});
