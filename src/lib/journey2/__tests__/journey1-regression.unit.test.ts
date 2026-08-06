import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { startAssignedJourney } from "../route";

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe("[unit, mocked] Journey 1 regression", () => {
  beforeEach(() => invoke.mockReset());

  it("sends a v1-assigned visitor to the quote-led journey", async () => {
    invoke.mockResolvedValue({ data: { ok: true, journey_version: "v1", redirect: "/build-plan" }, error: null });
    const navigate = vi.fn();
    await startAssignedJourney(navigate);
    expect(navigate).toHaveBeenCalledWith("/build-plan");
  });

  it("does not silently fall back to Journey 1 when assignment fails", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    const navigate = vi.fn();
    const onError = vi.fn();
    await startAssignedJourney(navigate, onError);
    expect(navigate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});
