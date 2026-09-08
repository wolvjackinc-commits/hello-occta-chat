import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import OcctaLoader from "../OcctaLoader";

describe("OcctaLoader", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("does not show anything for very short waits", () => {
    render(<OcctaLoader context="address" delayMs={250} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appears with an accessible live status after the delay", () => {
    render(<OcctaLoader context="availability" delayMs={250} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Checking the best connection");
  });

  it("shows a calm slow message when the wait is unusually long", () => {
    render(<OcctaLoader context="checkout" delayMs={0} />);
    act(() => {
      vi.advanceTimersByTime(8500);
    });
    expect(screen.getByRole("status").textContent).toContain("taking a little longer");
  });

  it("uses an explicit label when provided", () => {
    render(<OcctaLoader context="page" delayMs={0} label="Loading your order…" />);
    expect(screen.getByRole("status").textContent).toContain("Loading your order…");
  });
});
