import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { helpArticles, helpCategories, searchHelpArticles } from "./helpArticles";
import { faqCategories, faqs } from "./faqs";

const root = resolve(__dirname, "../..");
const sitemap = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");

const allText = [
  ...helpArticles.flatMap((a) => [a.title, a.description, a.intro, ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]), ...a.faqs.flatMap((f) => [f.question, f.answer])]),
  ...faqs.flatMap((f) => [f.question, f.answer]),
].join("\n");

describe("help centre content", () => {
  it("has unique slugs", () => {
    const slugs = helpArticles.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every related slug resolves", () => {
    const slugs = new Set(helpArticles.map((a) => a.slug));
    for (const a of helpArticles) for (const r of a.related ?? []) expect(slugs.has(r), `${a.slug} → ${r}`).toBe(true);
  });

  it("every category has at least one article", () => {
    for (const c of helpCategories) expect(helpArticles.some((a) => a.category === c), c).toBe(true);
  });

  it("every article is in the sitemap", () => {
    for (const a of helpArticles) expect(sitemap, a.slug).toContain(`/help/${a.slug}</loc>`);
  });

  it("every FAQ uses a known category", () => {
    const ids = new Set(faqCategories.map((c) => c.id));
    for (const f of faqs) expect(ids.has(f.category), f.question).toBe(true);
  });

  it("never offers card or phone payment", () => {
    expect(allText).not.toMatch(/pay (instantly|online) from your dashboard|pay by card|card payment page|pay over the phone with/i);
  });

  it("avoids claims the contract does not make", () => {
    const banned = [/24\/7/, /Automatic compensation/, /Ombudsman Services/i, /late[- ]payment fee of £5/i, /suspended after 30 days/i, /No contracts/, /Cancel anytime/, /8 weeks/, /service-status/];
    for (const b of banned) expect(allText, String(b)).not.toMatch(b);
  });

  it("search finds articles by keyword", () => {
    expect(searchHelpArticles("PAC code")[0]?.slug).toBe("keep-your-mobile-number-pac");
    expect(searchHelpArticles("bank details").map((a) => a.slug)).toContain("pay-by-bank-transfer");
  });
});
