import { describe, expect, it } from "vitest";
import { buildLineCheckMessage, lineCheckUtm, outreachTokenFromSearch } from "../lineCheck";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

describe("outreachTokenFromSearch", () => {
  it("reads the recipient token from utm_term", () => {
    expect(outreachTokenFromSearch(`?utm_source=occta_outreach&utm_term=ob-${TOKEN}`)).toBe(TOKEN);
  });
  it("falls back to the on-site click token", () => {
    expect(outreachTokenFromSearch(`ot=${TOKEN}&ol=0`)).toBe(TOKEN);
  });
  it("ignores malformed or missing tokens", () => {
    expect(outreachTokenFromSearch("?utm_term=ob-short")).toBeNull();
    expect(outreachTokenFromSearch("?utm_term=summer-sale")).toBeNull();
    expect(outreachTokenFromSearch("")).toBeNull();
    expect(outreachTokenFromSearch(`?utm_term=ob-${TOKEN}%3Cscript%3E`)).toBeNull();
  });
});

describe("lineCheckUtm", () => {
  it("keeps campaign parameters and drops everything else", () => {
    expect(lineCheckUtm(`?utm_source=occta_outreach&utm_campaign=uk-a&utm_term=ob-${TOKEN}&cc=UK-A&ot=${TOKEN}&x=1`)).toEqual({
      utm_source: "occta_outreach",
      utm_campaign: "uk-a",
      utm_term: `ob-${TOKEN}`,
      cc: "UK-A",
    });
  });
  it("is empty for a direct visit", () => {
    expect(lineCheckUtm("")).toEqual({});
  });
});

describe("buildLineCheckMessage", () => {
  it("summarises call time and equipment for the sales team", () => {
    const msg = buildLineCheckMessage({ callTime: "morning", items: ["Card machine", "Alarm"] });
    expect(msg).toContain("Best time to call: Morning");
    expect(msg).toContain("On the line: Card machine, Alarm");
  });
  it("ignores unknown items", () => {
    expect(buildLineCheckMessage({ callTime: "any", items: ["<b>x</b>"] })).toContain("On the line: not given");
  });
});
