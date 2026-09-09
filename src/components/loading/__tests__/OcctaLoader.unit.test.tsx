import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import OcctaLoader from "../OcctaLoader";

describe("OcctaLoader", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("does not show anything for a sub-threshold wait", () => {
    render(<OcctaLoader context="address" />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => vi.advanceTimersByTime(899));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows destination skeletons with an accessible status after the delay", () => {
    const { container } = render(<OcctaLoader context="availability" />);
    act(() => vi.advanceTimersByTime(900));
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Checking the best connection");
    expect(container.querySelectorAll(".occta-skeleton")).toHaveLength(2);
  });

  it("shows the editorial fact panel only for a genuine long wait", () => {
    render(<OcctaLoader context="checkout" />);
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.queryByLabelText("While you wait")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText("While you wait")).toBeTruthy();
  });

  it("uses an explicit label when provided", () => {
    render(<OcctaLoader context="page" delayMs={0} label="Loading your order…" />);
    expect(screen.getByRole("status").textContent).toContain("Loading your order…");
  });

  it("does not live-announce rotating trivia", () => {
    render(<OcctaLoader context="documents" delayMs={0} />);
    act(() => vi.advanceTimersByTime(3000));
    const panel = screen.getByLabelText("While you wait");
    expect(panel.querySelector('[aria-live]')).toBeNull();
    expect(panel.querySelector('.occta-fact-fade')?.textContent).toContain("The Web began");
  });

  it("keeps payment waits restrained and free of consumer trivia", () => {
    render(<OcctaLoader context="payment" delayMs={0} />);
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("status").textContent).toContain("Keep this page open");
    expect(screen.queryByLabelText("While you wait")).toBeNull();
  });
});
