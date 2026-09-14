import { beforeEach, expect, it, vi } from "vitest";
import { trackConversion } from "../conversionTracking";
import { trackCheckoutEvent } from "@/lib/checkoutTracking";
import type { Journey2Session } from "../client";
vi.mock("@/lib/checkoutTracking", () => ({ trackCheckoutEvent: vi.fn().mockResolvedValue(true) }));
const session = { test_session: false, utm_snapshot: { source_type: "google_ads" }, customer_details: { email: "private@example.com" } } as Journey2Session;
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
it("requires analytics consent and excludes tests", async () => {
  await trackConversion(session, "private-token", "address", "view");
  localStorage.setItem("occta.cookie-consent.v1", "denied");
  await trackConversion(session, "private-token", "address", "view");
  localStorage.setItem("occta.cookie-consent.v1", "granted");
  await trackConversion({ ...session, test_session: true }, "private-token", "address", "view");
  expect(trackCheckoutEvent).not.toHaveBeenCalled();
});
it("records stage/device/source without copying customer data or token into metadata", async () => {
  localStorage.setItem("occta.cookie-consent.v1", "granted");
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
  await trackConversion(session, "private-token", "billing", "save_error");
  expect(trackCheckoutEvent).toHaveBeenCalledWith(expect.objectContaining({ route: "/order/:token", stage: "billing", eventType: "error", metadata: { surface: "journey2_conversion", schema_version: 1, action: "save_error", device_type: "mobile", source_type: "google_ads" } }));
});
it("does not accept arbitrary stages or source strings", async () => {
  localStorage.setItem("occta.cookie-consent.v1", "granted");
  await trackConversion(session, "token", "private@example.com", "view");
  expect(trackCheckoutEvent).not.toHaveBeenCalled();
  await trackConversion({ ...session, utm_snapshot: { source_type: "private@example.com" } }, "token", "plan", "view");
  expect(trackCheckoutEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ source_type: "unknown" }) }));
});
