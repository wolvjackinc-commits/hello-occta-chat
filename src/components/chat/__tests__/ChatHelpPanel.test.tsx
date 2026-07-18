import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import ChatHelpPanel from "../ChatHelpPanel";

expect.extend(toHaveNoViolations);

function renderPanel(messages: { role: "user" | "assistant"; content: string }[] = []) {
  return render(
    <ChatHelpPanel
      messages={messages}
      onClose={vi.fn()}
      onEscalate={vi.fn()}
      onCreateTicket={vi.fn()}
    />
  );
}

describe("ChatHelpPanel", () => {
  it("highlights matched terms in search results", () => {
    renderPanel();
    const input = screen.getByLabelText(/search help centre/i);
    fireEvent.change(input, { target: { value: "invoice" } });

    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    // At least one <mark> should contain "invoice" (case insensitive).
    expect(
      Array.from(marks).some((m) => /invoice/i.test(m.textContent ?? ""))
    ).toBe(true);
  });

  it("shows a Top match badge on the first result", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/search help centre/i), {
      target: { value: "broadband" },
    });
    // The very first result card should include the Top match badge.
    const firstCard = screen.getAllByRole("link")[0];
    expect(within(firstCard).getByText(/top match/i)).toBeInTheDocument();
  });

  it("shows top sources based on the conversation when no query is entered", () => {
    renderPanel([
      { role: "user", content: "I want to change my broadband plan" },
      { role: "assistant", content: "Sure!" },
    ]);
    expect(screen.getByText(/top sources from your chat/i)).toBeInTheDocument();
  });

  it("has no critical accessibility violations", async () => {
    const { container } = renderPanel();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});