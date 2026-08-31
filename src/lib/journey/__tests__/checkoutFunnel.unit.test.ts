import { describe, expect, it } from "vitest";
import {
  ACTIVE_RECENCY_HOURS,
  FUNNEL_WINDOW_DAYS,
  isRecentlyActive,
  summariseCheckoutFunnel,
  type FunnelRow,
} from "@/lib/journey/checkoutFunnel";

const NOW = new Date("2026-08-31T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("checkout funnel reporting", () => {
  it("uses a 30 day reporting window", () => {
    expect(FUNNEL_WINDOW_DAYS).toBe(30);
  });

  it("counts a non-terminal session as active only when recently touched", () => {
    expect(isRecentlyActive({ status: "in_progress", last_activity_at: hoursAgo(2) }, NOW)).toBe(true);
    expect(
      isRecentlyActive({ status: "in_progress", last_activity_at: hoursAgo(ACTIVE_RECENCY_HOURS + 1) }, NOW),
    ).toBe(false);
    expect(isRecentlyActive({ status: "completed", last_activity_at: hoursAgo(1) }, NOW)).toBe(false);
    expect(isRecentlyActive({ status: "in_progress", last_activity_at: null }, NOW)).toBe(false);
  });

  it("separates recent active from stale active sessions", () => {
    const rows: FunnelRow[] = [
      { status: "in_progress", last_activity_at: hoursAgo(1) },
      { status: "contract_prepared", last_activity_at: hoursAgo(10) },
      { status: "in_progress", last_activity_at: hoursAgo(400) },
    ];
    const s = summariseCheckoutFunnel(rows, NOW);
    expect(s.activeRecent).toBe(2);
    expect(s.activeStale).toBe(1);
    expect(s.started).toBe(3);
  });

  it("computes conversion from started sessions excluding cancelled", () => {
    const rows: FunnelRow[] = [
      { status: "completed", last_activity_at: hoursAgo(3) },
      { status: "completed", last_activity_at: hoursAgo(4) },
      { status: "abandoned", last_activity_at: hoursAgo(50) },
      { status: "in_progress", last_activity_at: hoursAgo(1) },
      { status: "cancelled", last_activity_at: hoursAgo(6) },
    ];
    const s = summariseCheckoutFunnel(rows, NOW);
    expect(s.completed).toBe(2);
    expect(s.cancelled).toBe(1);
    expect(s.eligibleStarted).toBe(4);
    expect(s.conversionRate).toBe(50);
  });

  it("returns a null conversion rate rather than 0% when there is no eligible data", () => {
    const s = summariseCheckoutFunnel([{ status: "cancelled", last_activity_at: hoursAgo(1) }], NOW);
    expect(s.eligibleStarted).toBe(0);
    expect(s.conversionRate).toBeNull();
  });

  it("counts sessions with errors independently of status", () => {
    const s = summariseCheckoutFunnel(
      [
        { status: "completed", last_activity_at: hoursAgo(1), error_count: 2 },
        { status: "in_progress", last_activity_at: hoursAgo(1), error_count: 0 },
      ],
      NOW,
    );
    expect(s.withErrors).toBe(1);
  });
});
