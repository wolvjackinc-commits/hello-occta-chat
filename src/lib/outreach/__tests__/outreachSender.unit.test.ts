import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The sender runs on Deno; give it the bits of the Deno global it uses.
const env: Record<string, string> = {
  SUPABASE_URL: "https://proj.supabase.co",
  SITE_URL: "https://www.occta.co.uk",
  RESEND_API_KEY: "re_test",
};
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => env[k] } };

const { runOutreachTick, renderOutreachEmail, buildCampaignLinks } = await import("../../../../supabase/functions/_shared/outreachSender.ts");

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Tiny in-memory stand-in for the parts of supabase-js the sender uses. */
function fakeDb(tables: Tables) {
  const matches = (row: Row, filters: ((r: Row) => boolean)[]) => filters.every((f) => f(row));
  function builder(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "update" | "insert" = "select";
    let patch: Row = {};
    let head = false;
    let wantCount = false;
    const q = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (op === "select") { head = Boolean(opts?.head); wantCount = Boolean(opts?.count); }
        return q;
      },
      eq(k: string, v: unknown) { filters.push((r) => r[k] === v); return q; },
      in(k: string, vs: unknown[]) { filters.push((r) => vs.includes(r[k])); return q; },
      lte(k: string, v: string) { filters.push((r) => r[k] != null && String(r[k]) <= v); return q; },
      gte(k: string, v: string) { filters.push((r) => r[k] != null && String(r[k]) >= v); return q; },
      update(p: Row) { op = "update"; patch = p; return q; },
      insert(p: Row | Row[]) { op = "insert"; for (const r of Array.isArray(p) ? p : [p]) (tables[table] ??= []).push({ ...r }); return q; },
      run() {
        const rows = (tables[table] ??= []).filter((r) => matches(r, filters));
        if (op === "update") for (const r of rows) Object.assign(r, patch);
        return { data: head ? null : rows, error: null, count: wantCount ? rows.length : null };
      },
      single() { const r = q.run(); return Promise.resolve({ data: (r.data ?? [])[0] ?? null, error: null }); },
      maybeSingle() { return q.single(); },
      then(res: (v: unknown) => unknown) { return Promise.resolve(q.run()).then(res); },
    };
    return q;
  }
  return {
    from: builder,
    rpc(name: string, args: { p_limit: number }) {
      expect(name).toBe("outreach_claim_batch");
      const live = new Set(tables.outreach_campaigns.filter((c) => c.status === "sending").map((c) => c.id));
      const due = tables.outreach_messages.filter((m) => m.status === "queued" && live.has(m.campaign_id)).slice(0, args.p_limit);
      for (const m of due) { m.status = "sending"; m.attempt_count = Number(m.attempt_count) + 1; }
      return Promise.resolve({ data: due.map((m) => ({ ...m })), error: null });
    },
  };
}

const settings = {
  id: 1, sending_enabled: true, from_name: "OCCTA Business", from_email: "business@mail.occta.co.uk", reply_to: "business@occta.co.uk",
  daily_cap: 30, hourly_cap: 15, window_start_hour: 9, window_end_hour: 17, weekdays_only: true,
  recontact_cooldown_days: 30, postal_address: "OCCTA Limited, 22 Pavilion View, Huddersfield, HD3 3WU",
};
const campaign = {
  id: "camp1", name: "Test", slug: "test-camp", status: "sending",
  subject: "Hi {{business_name}}", preheader: null,
  body_html: `<p>Hello {{business_name}}</p><p><a href="https://www.occta.co.uk/business/voice">Voice</a></p>`,
  body_text: "Hello {{business_name}} {{cta_url}}", cta_label: "Book", cta_path: "/business/contact-sales",
  hero_image_url: null, flyer_ref: "LAST-A", template_key: "last-orders-landline", links: [] as unknown[],
};
const eligibleContact = (id: string, email: string) => ({
  id, business_name: `Biz ${id} Ltd`, email, area: null, district: "HD1", category: "Retail", status: "active",
  lawful_basis: "corporate_subscriber", companies_house_verified: true, companies_house_number: "12345678",
  legal_form: "limited_company", email_type: "role", consent_evidence: null,
});

function setup(over: Partial<Tables> = {}) {
  campaign.links = buildCampaignLinks(campaign);
  const tables: Tables = {
    outreach_settings: [{ ...settings }],
    outreach_campaigns: [{ ...campaign }],
    outreach_contacts: [eligibleContact("c1", "info@one.co.uk"), eligibleContact("c2", "info@two.co.uk"), { ...eligibleContact("c3", "info@three.co.uk"), legal_form: "sole_trader" }],
    outreach_suppressions: [{ email: "info@two.co.uk" }],
    outreach_messages: [
      { id: "m1", campaign_id: "camp1", contact_id: "c1", email: "info@one.co.uk", business_name: "Biz c1 Ltd", token: "tok_one_1234567890ab", status: "queued", attempt_count: 0 },
      { id: "m2", campaign_id: "camp1", contact_id: "c2", email: "info@two.co.uk", business_name: "Biz c2 Ltd", token: "tok_two_1234567890ab", status: "queued", attempt_count: 0 },
      { id: "m3", campaign_id: "camp1", contact_id: "c3", email: "info@three.co.uk", business_name: "Biz c3 Ltd", token: "tok_three_123456789a", status: "queued", attempt_count: 0 },
    ],
    outreach_events: [],
    ...over,
  };
  return { tables, db: fakeDb(tables) };
}

const MONDAY_10AM_BST = new Date("2026-10-12T09:00:00Z");
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1000 });
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_msg_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("runOutreachTick", () => {
  it("sends to eligible recipients and skips anyone suppressed or ineligible", async () => {
    const { tables, db } = setup();
    const r = await runOutreachTick(db, MONDAY_10AM_BST);
    expect(r.sent).toBe(1);
    expect(r.suppressed).toBe(2);
    const byId = Object.fromEntries(tables.outreach_messages.map((m) => [m.id, m]));
    expect(byId.m1.status).toBe("sent");
    expect(byId.m1.provider_message_id).toBe("re_msg_1");
    expect(byId.m2.status).toBe("suppressed");
    expect(byId.m3.status).toBe("suppressed");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("outreach-m1");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["info@one.co.uk"]);
    expect(body.from).toBe("OCCTA Business <business@mail.occta.co.uk>");
    expect(body.subject).toBe("Hi Biz c1 Ltd");
    expect(body.headers["List-Unsubscribe"]).toBe("<https://proj.supabase.co/functions/v1/outreach-unsubscribe?t=tok_one_1234567890ab>");
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(body.html).toContain("outreach-track?t=tok_one_1234567890ab&amp;l=0");
    expect(body.html).toContain("outreach-track?t=tok_one_1234567890ab&amp;l=1");
    expect(body.html).toContain("outreach-track?t=tok_one_1234567890ab&amp;o=1");
    expect(body.html).toContain("https://www.occta.co.uk/unsubscribe?t=tok_one_1234567890ab");
    expect(body.html).toContain("13828933");
    expect(body.text).toContain("Unsubscribe with one click");
    // Every message has been processed, so the campaign closes.
    expect(tables.outreach_campaigns[0].status).toBe("completed");
  });

  it("does nothing outside the sending window, at weekends or when switched off", async () => {
    for (const [when, over] of [
      [new Date("2026-10-12T17:30:00Z"), {}],
      [new Date("2026-10-17T10:00:00Z"), {}],
      [MONDAY_10AM_BST, { sending_enabled: false }],
      [MONDAY_10AM_BST, { from_email: null }],
    ] as const) {
      const { tables, db } = setup({ outreach_settings: [{ ...settings, ...over }] });
      const r = await runOutreachTick(db, when);
      expect(r.sent).toBe(0);
      expect(r.skipped).toBeTruthy();
      expect(tables.outreach_messages.every((m) => m.status === "queued")).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at the daily cap", async () => {
    const sentToday = Array.from({ length: 30 }, (_, i) => ({ id: `old${i}`, campaign_id: "x", status: "sent", sent_at: "2026-10-12T08:30:00.000Z" }));
    const { tables, db } = setup();
    tables.outreach_messages.push(...sentToday);
    const r = await runOutreachTick(db, MONDAY_10AM_BST);
    expect(r.skipped).toBe("cap_reached");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pauses the campaign and keeps the email queued when the domain is rejected", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "The domain is not verified" }), { status: 403 }));
    const { tables, db } = setup();
    const r = await runOutreachTick(db, MONDAY_10AM_BST);
    expect(r.sent).toBe(0);
    expect(r.paused_campaigns).toEqual(["camp1"]);
    expect(tables.outreach_campaigns[0].status).toBe("paused");
    expect(String(tables.outreach_campaigns[0].paused_reason)).toMatch(/verified/);
    expect(tables.outreach_messages.find((m) => m.id === "m1")?.status).toBe("queued");
    expect(tables.outreach_messages.find((m) => m.id === "m1")?.attempt_count).toBe(0);
  });

  it("backs off on rate limits without using up a retry", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    const { tables, db } = setup();
    const r = await runOutreachTick(db, MONDAY_10AM_BST);
    expect(r.sent).toBe(0);
    const m1 = tables.outreach_messages.find((m) => m.id === "m1")!;
    expect(m1.status).toBe("queued");
    expect(m1.attempt_count).toBe(0);
    expect(tables.outreach_campaigns[0].status).toBe("sending");
  });

  it("fails permanently on an invalid address and retries on provider errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 422 }));
    let ctx = setup();
    await runOutreachTick(ctx.db, MONDAY_10AM_BST);
    expect(ctx.tables.outreach_messages.find((m) => m.id === "m1")?.status).toBe("failed");

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    ctx = setup();
    await runOutreachTick(ctx.db, MONDAY_10AM_BST);
    const m1 = ctx.tables.outreach_messages.find((m) => m.id === "m1")!;
    expect(m1.status).toBe("queued");
    expect(Date.parse(String(m1.next_attempt_at))).toBeGreaterThan(Date.now() + 4 * 60_000);
  });

  it("stops sending when the campaign is paused mid-batch", async () => {
    const { tables, db } = setup();
    // Pause is pressed right after the sender claimed its batch.
    const claim = db.rpc;
    db.rpc = async (...args: Parameters<typeof claim>) => {
      const res = await claim(...args);
      tables.outreach_campaigns[0].status = "paused";
      return res;
    };
    await runOutreachTick(db, MONDAY_10AM_BST);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tables.outreach_messages.every((m) => m.status === "queued")).toBe(true);
  });
});

describe("renderOutreachEmail without tracking (previews and tests)", () => {
  it("links straight to the site with campaign tags and no pixel", () => {
    const e = renderOutreachEmail({
      campaign: { ...campaign, links: buildCampaignLinks(campaign) },
      settings,
      recipient: { email: "info@x.co.uk", business_name: "X & Co Ltd" },
      token: "preview-token-0000000",
      tracking: false,
    });
    expect(e.html).not.toContain("outreach-track");
    expect(e.html).toContain("https://www.occta.co.uk/business/contact-sales?utm_source=occta_outreach&amp;utm_medium=email&amp;utm_campaign=test-camp");
    expect(e.html).toContain("https://www.occta.co.uk/business/voice?utm_source=occta_outreach");
    expect(e.html).toContain("Hello X &amp; Co Ltd");
    expect(e.headers).toEqual({});
  });
});
