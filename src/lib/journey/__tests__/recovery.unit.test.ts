import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { RECOVERY_OUTCOMES, inView, isCallbackDue, isWorkable, outcomeLabel, telHref } from "../recovery";

const base = { opted_out_at: null, last_outcome: null, callback_at: null, existing_customer: false };
const NOW = Date.parse("2026-11-04T18:00:00Z");

describe("recovery helpers", () => {
  it("keeps UI outcomes identical to the database constraint", () => {
    const sql = readFileSync("supabase/migrations/20261104190000_checkout_recovery_desk.sql", "utf8");
    const check = sql.match(/outcome IN \(([\s\S]*?)\)\),/)?.[1] ?? "";
    const dbValues = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(RECOVERY_OUTCOMES.map((o) => o.value).sort()).toEqual(dbValues);
  });

  it("builds tel links for UK numbers and rejects junk", () => {
    expect(telHref("07700 900123")).toBe("tel:+447700900123");
    expect(telHref("+44 7700 900123")).toBe("tel:+447700900123");
    expect(telHref("447700900123")).toBe("tel:+447700900123");
    expect(telHref("01484 123456")).toBe("tel:+441484123456");
    expect(telHref("12345")).toBeNull();
    expect(telHref("abc")).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it("labels outcomes", () => {
    expect(outcomeLabel(null)).toBe("Not contacted");
    expect(outcomeLabel("voicemail")).toBe("Left voicemail");
  });

  it("drops opted-out, existing customers and dead ends from the to-do list", () => {
    expect(isWorkable(base)).toBe(true);
    expect(isWorkable({ ...base, opted_out_at: "2026-11-01T00:00:00Z" })).toBe(false);
    expect(isWorkable({ ...base, existing_customer: true })).toBe(false);
    expect(isWorkable({ ...base, last_outcome: "not_interested" })).toBe(false);
    expect(isWorkable({ ...base, last_outcome: "no_answer" })).toBe(true);
  });

  it("only shows a callback in to-do once it is due", () => {
    const later = { ...base, last_outcome: "callback_requested", callback_at: "2026-11-05T10:00:00Z" };
    const due = { ...later, callback_at: "2026-11-04T17:00:00Z" };
    expect(isCallbackDue(later, NOW)).toBe(false);
    expect(isCallbackDue(due, NOW)).toBe(true);
    expect(inView(later, "todo", NOW)).toBe(false);
    expect(inView(due, "todo", NOW)).toBe(true);
    expect(inView(later, "callbacks", NOW)).toBe(true);
    expect(inView(base, "contacted", NOW)).toBe(false);
  });
});
