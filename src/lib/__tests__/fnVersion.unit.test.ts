import { describe, expect, it } from "vitest";
import {
  OCCTA_FN_BUILD,
  OCCTA_FN_IDS,
  OCCTA_FN_VERSION_HEADER,
  fnVersionHeaders,
  fnVersionProbe,
  fnVersionValue,
} from "../../../supabase/functions/_shared/fnVersion.ts";

describe("edge function version marker", () => {
  it("names the header operators can read without creating a record", () => {
    expect(OCCTA_FN_VERSION_HEADER).toBe("x-occta-fn-version");
    expect(OCCTA_FN_BUILD).toMatch(/^[a-z0-9-]+$/i);
    expect(OCCTA_FN_BUILD.length).toBeLessThan(40);
  });

  it("stamps journey and business submit functions with the same build", () => {
    expect(OCCTA_FN_IDS).toEqual([
      "journey2-session",
      "submit-business-lead",
      "submit-business-quote",
    ]);
    for (const fn of OCCTA_FN_IDS) {
      expect(fnVersionValue(fn)).toBe(`${fn}@${OCCTA_FN_BUILD}`);
      const headers = fnVersionHeaders(fn);
      expect(headers[OCCTA_FN_VERSION_HEADER]).toBe(`${fn}@${OCCTA_FN_BUILD}`);
      expect(headers["Access-Control-Expose-Headers"]).toBe(OCCTA_FN_VERSION_HEADER);
      expect(fnVersionProbe(fn)).toEqual({
        ok: true,
        fn,
        version: `${fn}@${OCCTA_FN_BUILD}`,
      });
    }
  });
});
