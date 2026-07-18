import { describe, it, expect, vi } from "vitest";
import { useRef } from "react";
import { render, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";

function TrapHarness({
  active,
  onEscape,
}: {
  active: boolean;
  onEscape: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap({ active, container: ref, onEscape });
  return (
    <div ref={ref} data-testid="trap">
      <button data-testid="first">First</button>
      <input data-testid="middle" />
      <button data-testid="last">Last</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("calls onEscape when Escape is pressed while active", () => {
    const onEscape = vi.fn();
    render(<TrapHarness active onEscape={onEscape} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does not fire Escape callback when inactive", () => {
    const onEscape = vi.fn();
    render(<TrapHarness active={false} onEscape={onEscape} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("wraps focus from the last element to the first on Tab", () => {
    const { getByTestId } = render(<TrapHarness active onEscape={() => {}} />);
    const first = getByTestId("first");
    const last = getByTestId("last");
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("wraps focus from the first element to the last on Shift+Tab", () => {
    const { getByTestId } = render(<TrapHarness active onEscape={() => {}} />);
    const first = getByTestId("first");
    const last = getByTestId("last");
    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("does nothing on Tab when middle element is focused", () => {
    const { getByTestId } = render(<TrapHarness active onEscape={() => {}} />);
    const middle = getByTestId("middle");
    middle.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    // Focus stays where it was — browser's default Tab handling would move it,
    // but jsdom won't; the trap must simply not intercept.
    expect(document.activeElement).toBe(middle);
  });
});