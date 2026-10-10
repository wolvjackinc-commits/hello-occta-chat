import { beforeEach, describe, expect, it } from "vitest";
import { getAttribution } from "@/lib/attribution";
import {
  CAMPAIGN_TOUCH_STORAGE_KEY,
  CAMPAIGN_TOUCH_TTL_MS,
  attributionRecordForJourney,
  campaignAlertHtml,
  formatCampaignQrLabel,
  getStoredCampaignCode,
  mergeUtmSnapshot,
  normaliseReferenceCode,
  rememberCampaignTouch,
  sanitizeCampaignUtm,
  type CaptureContext,
} from "@/lib/campaignAttribution";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-10T12:00:00.000Z");

function ctx(overrides: Partial<CaptureContext> = {}): CaptureContext {
  return {
    search: "",
    pathname: "/broadband",
    hostname: "occta.co.uk",
    referrer: "",
    consentGranted: false,
    now: NOW,
    ...overrides,
  };
}

const FLYER = "?utm_source=leaflet&utm_medium=qr&utm_campaign=consumer-pricelock-oct2026&utm_content=a5-va-v4&qr=c2-lfa&cc=LOCK-a";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("campaign reference codes", () => {
  it("uppercases a valid cc and accepts rc as an alias", () => {
    expect(normaliseReferenceCode("lock-a")).toBe("LOCK-A");
    expect(normaliseReferenceCode("LAST-A")).toBe("LAST-A");
    expect(normaliseReferenceCode("NO")).toBeNull();
    expect(normaliseReferenceCode("LOCK_A")).toBeNull();
    expect(normaliseReferenceCode("has space")).toBeNull();
    const fromRc = rememberCampaignTouch(ctx({ search: "?rc=last-a", pathname: "/business/contact-sales" }));
    expect(fromRc.cc).toBe("LAST-A");
    expect(getStoredCampaignCode(NOW)).toBe("LAST-A");
  });

  it("prefers cc over rc and never reads the customer referral ref parameter", () => {
    const touch = rememberCampaignTouch(ctx({ search: "?cc=LOCK-A&rc=LAST-A&ref=ABCDEFGH" }));
    expect(touch.cc).toBe("LOCK-A");
    expect(JSON.stringify(touch)).not.toContain("ABCDEFGH");
    expect(touch.landing_path).not.toContain("ref=");
  });
});

describe("first-touch persistence", () => {
  it("stores flyer tags from the landing URL and keeps them when a later page is direct", () => {
    const first = rememberCampaignTouch(ctx({
      search: FLYER,
      referrer: "https://instagram.com/stories/occta",
    }));
    expect(first).toMatchObject({
      utm_source: "leaflet",
      utm_medium: "qr",
      utm_campaign: "consumer-pricelock-oct2026",
      utm_content: "a5-va-v4",
      qr_id: "c2-lfa",
      cc: "LOCK-A",
      source_type: "qr_flyer",
      referrer_host: "instagram.com",
      referrer_path: "/stories/occta",
    });
    expect(first.landing_path).toContain("/broadband?");
    expect(first.landing_path).toContain("qr=c2-lfa");
    expect(first.landing_path).not.toContain("gclid");

    const later = rememberCampaignTouch(ctx({ search: "", pathname: "/order", now: NOW + DAY }));
    expect(later.utm_campaign).toBe("consumer-pricelock-oct2026");
    expect(later.qr_id).toBe("c2-lfa");
    expect(later.cc).toBe("LOCK-A");
    expect(later.landing_path).toContain("/broadband");
    expect(later.expires_at).toBe(first.expires_at);

    const sent = attributionRecordForJourney(ctx({ search: "", pathname: "/order/details", now: NOW + 2 * DAY }));
    expect(sent.utm_source).toBe("leaflet");
    expect(sent.source_type).toBe("qr_flyer");
    expect(sent.cc).toBe("LOCK-A");
  });

  it("mirrors sessionStorage to localStorage and restores the touch after the tab store is cleared", () => {
    rememberCampaignTouch(ctx({ search: FLYER }));
    expect(sessionStorage.getItem(CAMPAIGN_TOUCH_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(CAMPAIGN_TOUCH_STORAGE_KEY)).toBe(sessionStorage.getItem(CAMPAIGN_TOUCH_STORAGE_KEY));
    sessionStorage.clear();
    const restored = attributionRecordForJourney(ctx({ search: "", pathname: "/order", now: NOW + DAY }));
    expect(restored.cc).toBe("LOCK-A");
    expect(sessionStorage.getItem(CAMPAIGN_TOUCH_STORAGE_KEY)).toContain("LOCK-A");
  });

  it("drops an expired touch and then accepts a new flyer", () => {
    rememberCampaignTouch(ctx({ search: "?utm_campaign=old-flyer&cc=OLD-A", now: NOW - CAMPAIGN_TOUCH_TTL_MS - DAY }));
    const next = rememberCampaignTouch(ctx({ search: "?utm_campaign=new-flyer&qr=b2-lfa&cc=LAST-A", pathname: "/business/contact-sales" }));
    expect(next.utm_campaign).toBe("new-flyer");
    expect(next.qr_id).toBe("b2-lfa");
    expect(next.cc).toBe("LAST-A");
  });

  it("upgrades a direct landing when the first real campaign arrives, and ignores a second campaign", () => {
    rememberCampaignTouch(ctx({ search: "", pathname: "/" }));
    const flyer = rememberCampaignTouch(ctx({ search: FLYER, now: NOW + 1000 }));
    expect(flyer.cc).toBe("LOCK-A");
    const second = rememberCampaignTouch(ctx({
      search: "?utm_campaign=other&qr=b2-lfa&cc=LAST-A",
      pathname: "/business/contact-sales",
      now: NOW + 2000,
    }));
    expect(second.utm_campaign).toBe("consumer-pricelock-oct2026");
    expect(second.cc).toBe("LOCK-A");
  });

  it("stores click IDs only when analytics consent is granted, and only for that landing", () => {
    const denied = rememberCampaignTouch(ctx({ search: `${FLYER}&gclid=secret-click`, consentGranted: false }));
    expect(denied.gclid).toBeUndefined();
    sessionStorage.clear();
    localStorage.clear();
    const granted = rememberCampaignTouch(ctx({ search: `${FLYER}&gclid=secret-click`, consentGranted: true }));
    expect(granted.gclid).toBe("secret-click");
    expect(granted.landing_path).not.toContain("gclid");
    const navigated = rememberCampaignTouch(ctx({
      search: "?gclid=later-click",
      pathname: "/order",
      consentGranted: true,
      now: NOW + 1000,
    }));
    expect(navigated.gclid).toBe("secret-click");
    expect(navigated.cc).toBe("LOCK-A");
  });

  it("adds a click ID when consent is granted on the same landing, and removes it if consent is withdrawn", () => {
    rememberCampaignTouch(ctx({ search: `${FLYER}&gclid=secret-click`, consentGranted: false }));
    const granted = rememberCampaignTouch(ctx({ search: `${FLYER}&gclid=secret-click`, consentGranted: true, now: NOW + 1000 }));
    expect(granted.gclid).toBe("secret-click");
    expect(granted.utm_campaign).toBe("consumer-pricelock-oct2026");
    const withdrawn = rememberCampaignTouch(ctx({ search: "", pathname: "/order", consentGranted: false, now: NOW + 2000 }));
    expect(withdrawn.gclid).toBeUndefined();
    expect(withdrawn.cc).toBe("LOCK-A");
  });
});

describe("server snapshot merge and admin label", () => {
  it("does not let a later direct touch replace the first campaign", () => {
    const merged = mergeUtmSnapshot(
      {
        utm_source: "leaflet",
        utm_campaign: "consumer-pricelock-oct2026",
        qr_id: "c2-lfa",
        cc: "LOCK-A",
        source_type: "qr_flyer",
        landing_path: "/broadband?utm_campaign=consumer-pricelock-oct2026",
      },
      { source_type: "direct", landing_path: "/order", captured_at: "2026-10-10T13:00:00.000Z" },
    );
    expect(merged.utm_source).toBe("leaflet");
    expect(merged.utm_campaign).toBe("consumer-pricelock-oct2026");
    expect(merged.cc).toBe("LOCK-A");
    expect(merged.qr_id).toBe("c2-lfa");
    expect((merged.latest_touch as Record<string, string>).source_type).toBe("direct");
    expect((merged.first_touch as Record<string, string>).cc).toBe("LOCK-A");
  });

  it("promotes a campaign over a direct placeholder and trims the allow-list", () => {
    const merged = mergeUtmSnapshot(
      { source_type: "direct", landing_path: "/" },
      { utm_source: "  leaflet  ", cc: "last-a", ref: "ABCDEFGH", evil: "<script>", qr: "b2-lfa" },
    );
    expect(merged.utm_source).toBe("leaflet");
    expect(merged.cc).toBe("LAST-A");
    expect(merged.qr_id).toBe("b2-lfa");
    expect(merged).not.toHaveProperty("ref");
    expect(merged).not.toHaveProperty("evil");
    expect(sanitizeCampaignUtm({ utm_source: "x".repeat(500), cc: "NO" })?.utm_source).toHaveLength(200);
    expect(sanitizeCampaignUtm({ utm_source: "x".repeat(500), cc: "NO" })?.cc).toBeUndefined();
  });

  it("formats an admin label and an internal email without click IDs", () => {
    expect(formatCampaignQrLabel({
      utm_campaign: "consumer-pricelock-oct2026",
      qr_id: "c2-lfa",
      cc: "LOCK-A",
      gclid: "secret-click",
    })).toBe("consumer-pricelock-oct2026 · QR c2-lfa · LOCK-A");
    const html = campaignAlertHtml({ utm_campaign: "consumer-pricelock-oct2026", qr_id: "c2-lfa", cc: "LOCK-A", gclid: "secret-click" });
    expect(html).toContain("consumer-pricelock-oct2026");
    expect(html).toContain("c2-lfa");
    expect(html).toContain("LOCK-A");
    expect(html).not.toContain("secret-click");
    expect(html).not.toContain("gclid");
  });
});

describe("existing quote attribution", () => {
  it("reads the stored first touch", () => {
    rememberCampaignTouch(ctx({ search: FLYER, now: Date.now() }));
    const attribution = getAttribution();
    expect(attribution.utm_source).toBe("leaflet");
    expect(attribution.utm_medium).toBe("qr");
    expect(attribution.utm_campaign).toBe("consumer-pricelock-oct2026");
    expect(attribution.gclid).toBeNull();
    expect(attribution.landing_page).toContain("cc=LOCK-a");
  });
});
