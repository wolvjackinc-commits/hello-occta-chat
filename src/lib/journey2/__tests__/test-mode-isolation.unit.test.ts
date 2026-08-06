import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { journey2 } from "../client";

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe("[unit, mocked] Test-mode isolation", () => {
  beforeEach(() => invoke.mockReset());

  it("marks an admin test submission as a test order, not a live order", async () => {
    invoke.mockResolvedValue({
      data: { ok: true, test_session: true, order_number: "TEST-J2-ABCD1234" },
      error: null,
    });
    const res = await journey2.submit("t".repeat(32));
    expect(res.test_session).toBe(true);
    expect(res.order_number).toMatch(/^TEST-J2-/);
    expect(res.order_id).toBeUndefined();
  });

  it("requests an admin test session explicitly", async () => {
    invoke.mockResolvedValue({ data: { ok: true, journey_version: "v2", token: "t".repeat(32) }, error: null });
    await journey2.start({ adminTest: true });
    expect((invoke.mock.calls[0][1] as any).body).toMatchObject({ admin_test: true });
  });
});
