import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/components/address/AddressAutocomplete", () => ({
  AddressAutocomplete: ({ onManualFallback }: { onManualFallback: () => void }) => (
    <button type="button" onClick={onManualFallback}>manual</button>
  ),
}));
import { NewPhoneOrderDialog } from "./NewPhoneOrderDialog";

function fill() {
  fireEvent.click(screen.getByText("Enter address manually"));
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "Jane Smith" } });
  fireEvent.change(screen.getByLabelText(/^Email \*/), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText(/^Mobile/), { target: { value: "07700900123" } });
  fireEvent.change(screen.getByLabelText(/Address line 1/), { target: { value: "1 High Street" } });
  fireEvent.change(screen.getByLabelText(/Postcode/), { target: { value: "HD1 1AA" } });
}

describe("assisted order dialog", () => {
  beforeEach(() => invoke.mockReset());

  it("phone order stays the default and sends channel=phone", async () => {
    invoke.mockResolvedValue({ data: { quote_request_id: "q1", reference: "QR-1", replayed: false }, error: null });
    const onCreated = vi.fn();
    render(<NewPhoneOrderDialog open onOpenChange={() => {}} onCreated={onCreated} />);
    expect(screen.getByText("New phone order")).toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByText("Save & build quote"));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledWith("admin-create-phone-quote-request",
      expect.objectContaining({ body: expect.objectContaining({ channel: "phone", email: "jane@example.com" }) }));
  });

  it("email order uses email wording and sends channel=email", async () => {
    invoke.mockResolvedValue({ data: { quote_request_id: "q2", reference: "QR-2", replayed: false }, error: null });
    const onCreated = vi.fn();
    render(<NewPhoneOrderDialog channel="email" open onOpenChange={() => {}} onCreated={onCreated} />);
    expect(screen.getByText("New email order")).toBeInTheDocument();
    expect(screen.getByLabelText(/Customer's requirements/)).toBeInTheDocument();
    expect(screen.queryByText(/Call notes/)).toBeNull();
    fill();
    fireEvent.click(screen.getByText("Save & build quote"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ reference: "QR-2" })));
    expect(invoke.mock.calls[0][1].body.channel).toBe("email");
  });

  it("blocks submit when required details are missing", async () => {
    render(<NewPhoneOrderDialog channel="email" open onOpenChange={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByText("Save & build quote"));
    await new Promise((r) => setTimeout(r, 20));
    expect(invoke).not.toHaveBeenCalled();
  });
});
