import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RaiseTicketDialog } from "../RaiseTicketDialog";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/components/kb/SuggestedArticles", () => ({
  default: () => null,
}));

describe("RaiseTicketDialog", () => {
  it("shows the transcript attachment option when a transcript prefill is provided", async () => {
    render(
      <RaiseTicketDialog
        open
        onOpenChange={vi.fn()}
        prefill={{
          category: "billing",
          subject: "Question about my invoice this month",
          message: "Please help me understand the charges on my recent bill.",
          transcript:
            "Me: I got charged twice.\n\nIRA: Let me check that for you.",
        }}
      />
    );
    // The checkbox should be visible and checked by default when a transcript is provided.
    const checkbox = await screen.findByRole("checkbox", {
      name: /attach my chat transcript/i,
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("does not show the transcript checkbox when no transcript is provided", () => {
    render(<RaiseTicketDialog open onOpenChange={vi.fn()} />);
    expect(
      screen.queryByRole("checkbox", { name: /attach my chat transcript/i })
    ).not.toBeInTheDocument();
  });
});