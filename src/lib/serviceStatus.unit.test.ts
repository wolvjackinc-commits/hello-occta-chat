import { describe, expect, it, vi } from "vitest";
import { type Incident, isUpcomingMaintenance, overallState, serviceStates } from "./serviceStatus";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const base: Incident = {
  id: "1",
  kind: "incident",
  title: "Test",
  summary: "",
  status: "investigating",
  impact: "major",
  affected_services: ["broadband"],
  affected_areas: null,
  starts_at: "2026-10-28T09:00:00Z",
  ends_at: null,
  resolved_at: null,
  is_public: true,
  created_at: "2026-10-28T09:00:00Z",
  updated_at: "2026-10-28T09:00:00Z",
};
const now = new Date("2026-10-28T12:00:00Z");

describe("service status", () => {
  it("is operational with no incidents", () => {
    expect(overallState(serviceStates([], now))).toBe("operational");
  });

  it("maps impact to service state and ignores unaffected services", () => {
    const s = serviceStates([base], now);
    expect(s.broadband).toBe("partial_outage");
    expect(s.mobile).toBe("operational");
    expect(overallState(s)).toBe("partial_outage");
  });

  it("worst incident wins", () => {
    const s = serviceStates([base, { ...base, id: "2", impact: "critical" }], now);
    expect(s.broadband).toBe("major_outage");
  });

  it("resolved incidents don't affect current state", () => {
    expect(serviceStates([{ ...base, status: "resolved" }], now).broadband).toBe("operational");
  });

  it("maintenance shows only during its window", () => {
    const m: Incident = { ...base, kind: "maintenance", status: "scheduled", impact: "none", starts_at: "2026-10-28T11:00:00Z", ends_at: "2026-10-28T13:00:00Z" };
    expect(serviceStates([m], now).broadband).toBe("maintenance");
    const later = { ...m, starts_at: "2026-10-29T01:00:00Z", ends_at: "2026-10-29T03:00:00Z" };
    expect(serviceStates([later], now).broadband).toBe("operational");
    expect(isUpcomingMaintenance(later, now)).toBe(true);
  });
});
