import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleSwitch50Delivery } from "../../../../supabase/functions/_shared/switch50Delivery";

const secret = "synthetic-worker-secret-for-tests-only";
const message = {
  id: "message-1", reward_id: "reward-1", lease_token: "lease-1", template: "reward_eligible",
  payload: { recipient_email: "customer@example.test", amount: 50, currency: "GBP", delay_days: 30, order_id: "test-order" },
};
const claim = vi.fn(), rewardStatus = vi.fn(), finish = vi.fn(), send = vi.fn();
const getStore = vi.fn(() => ({ claim, rewardStatus, finish }));
const options = () => ({ secret, enabled: "true", apiKey: "test-only", getStore, send });
const request = (key = secret) => new Request("https://worker.example.test", { method: "POST", headers: { "x-cron-secret": key } });

beforeEach(() => {
  vi.clearAllMocks();
  claim.mockResolvedValue({ messages: [message] });
  rewardStatus.mockResolvedValue("eligible");
  finish.mockResolvedValue(true);
  send.mockImplementation(async () => new Response(JSON.stringify({ id: "provider-1" }), { status: 200 }));
});

describe("actual SWITCH50 delivery HTTP handler", () => {
  it("rejects missing or wrong cron credentials before accessing customer data", async () => {
    expect((await handleSwitch50Delivery(request("wrong"), options())).status).toBe(401);
    expect((await handleSwitch50Delivery(request(), { ...options(), secret: undefined })).status).toBe(401);
    expect(getStore).not.toHaveBeenCalled();
  });
  it("leaves the queue untouched when disabled or provider configuration is missing", async () => {
    expect(await (await handleSwitch50Delivery(request(), { ...options(), enabled: undefined })).json()).toMatchObject({ disabled: true });
    expect((await handleSwitch50Delivery(request(), { ...options(), apiKey: undefined })).status).toBe(503);
    expect(getStore).not.toHaveBeenCalled();
  });
  it("claims a bounded batch and records the exact provider response against its lease", async () => {
    const result = await handleSwitch50Delivery(request(), options());
    expect(await result.json()).toEqual({ ok: true, sent: 1, failed: 0, suppressed: 0 });
    expect(claim).toHaveBeenCalledWith(5);
    expect(finish).toHaveBeenCalledWith("message-1", "lease-1", "provider-1", null);
    expect(send.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    expect(send.mock.calls[0][1].headers["Idempotency-Key"]).toBe("switch50/message-1");
  });
  it("suppresses queued eligibility emails after cancellation blocks the reward", async () => {
    rewardStatus.mockResolvedValue("blocked");
    expect(await (await handleSwitch50Delivery(request(), options())).json()).toMatchObject({ suppressed: 1, sent: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith("message-1", "lease-1", null, "superseded");
  });
  it("never sends when the current reward status cannot be verified", async () => {
    rewardStatus.mockRejectedValue(new Error("reward_read_failed"));
    await handleSwitch50Delivery(request(), options());
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith("message-1", "lease-1", null, "reward_read_failed");
  });
  it("records retryable provider errors without claiming the email was sent", async () => {
    send.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await (await handleSwitch50Delivery(request(), options())).json()).toMatchObject({ sent: 0, failed: 1 });
    expect(finish).toHaveBeenCalledWith("message-1", "lease-1", null, "provider_http_429");
  });
  it("reuses the same content and provider key after an ambiguous network timeout", async () => {
    send.mockRejectedValueOnce(new Error("timeout_after_acceptance"));
    await handleSwitch50Delivery(request(), options());
    await handleSwitch50Delivery(request(), options());
    expect(send.mock.calls[0][1].body).toBe(send.mock.calls[1][1].body);
    expect(send.mock.calls[0][1].headers).toEqual(send.mock.calls[1][1].headers);
  });
  it("returns unconfirmed delivery when the provider sent but the acknowledgement lease is stale", async () => {
    finish.mockResolvedValue(false);
    const result = await handleSwitch50Delivery(request(), options());
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ error: "delivery_record_unconfirmed", sent: 1 });
  });
  it("does not call the provider after a database claim failure", async () => {
    claim.mockResolvedValue({ messages: [], error: { code: "unavailable" } });
    expect((await handleSwitch50Delivery(request(), options())).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });
});
