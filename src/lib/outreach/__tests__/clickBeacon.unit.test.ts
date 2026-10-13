import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCampaignUtmForSubmit, rememberCampaignTouch, type CaptureContext } from "@/lib/campaignAttribution";
import { readOutreachVisitToken, reportOutreachClick } from "@/lib/outreach/clickBeacon";

const TOKEN = "tok_abcdefghijklmnop1234";
const NOW = Date.parse("2026-10-13T12:00:00.000Z");

function ctx(search: string): CaptureContext {
  return { search, pathname: "/", hostname: "occta.co.uk", referrer: "", consentGranted: false, now: NOW };
}

describe("outreach click on this visit", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: vi.fn(() => true) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("remembers the email token for the session and strips the click params", () => {
    window.history.replaceState(null, "", `/business/contact-sales?utm_source=occta_outreach&ot=${TOKEN}&ol=0`);
    reportOutreachClick();
    expect(readOutreachVisitToken()).toBe(TOKEN);
    expect(window.location.search).toBe("?utm_source=occta_outreach");
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("credits the enquiry to the email without replacing an older first-touch campaign", () => {
    rememberCampaignTouch(ctx("?utm_source=occta&utm_medium=email&utm_campaign=SWITCH50&utm_content=reminder_4"));
    window.history.replaceState(null, "", `/business/contact-sales?ot=${TOKEN}&ol=1`);
    reportOutreachClick();

    const utm = getCampaignUtmForSubmit(NOW);
    expect(utm?.utm_campaign).toBe("SWITCH50");
    expect(utm?.utm_term).toBe(`ob-${TOKEN}`);
  });

  it("leaves attribution unchanged when no outreach email was clicked", () => {
    rememberCampaignTouch(ctx("?utm_source=leaflet&utm_medium=qr&utm_campaign=flyer&utm_term=kw"));
    expect(getCampaignUtmForSubmit(NOW)?.utm_term).toBe("kw");
  });

  it("keeps an ob- term that is already on the touch", () => {
    rememberCampaignTouch(ctx("?utm_source=occta_outreach&utm_term=ob-tok_existing0000000000"));
    sessionStorage.setItem("occta_outreach_visit_v1", TOKEN);
    expect(getCampaignUtmForSubmit(NOW)?.utm_term).toBe("ob-tok_existing0000000000");
  });

  it("ignores a malformed stored token", () => {
    sessionStorage.setItem("occta_outreach_visit_v1", "bad token!");
    expect(readOutreachVisitToken()).toBeNull();
    expect(getCampaignUtmForSubmit(NOW)).toBeNull();
  });
});
