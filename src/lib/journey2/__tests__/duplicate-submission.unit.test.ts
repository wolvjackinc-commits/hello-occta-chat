import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { journey2 } from "../client";

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe("[unit, mocked] Duplicate submission", () => {
  beforeEach(() => invoke.mockReset());

  it("returns the same order for a repeated submission of one checkout session", async () => {
    invoke.mockResolvedValue({ data: { ok: true, order_id: "o1", order_number: "OCC-1" }, error: null });
    const a = await journey2.submit("t".repeat(32));
    const b = await journey2.submit("t".repeat(32));
    expect(a.order_id).toBe(b.order_id);
    expect(a.order_number).toBe(b.order_number);
  });

  it("surfaces a retryable failure rather than reporting a second order", async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: "snapshot_invalid", retryable: true }, error: null });
    const res = await journey2.submit("t".repeat(32));
    expect(res.ok).toBe(false);
    expect(res.error).toBe("snapshot_invalid");
  });
});
