// Guards the revision flow: a revised Contract Summary must always get a
// matching Contract Information Pack bound to it, must fail closed if it
// cannot, and the acceptance-time snapshot-integrity check must never be
// weakened or bypassed.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const revised = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const packFn = await Deno.readTextFile(
  new URL("../generate-contract-information-pack/index.ts", import.meta.url),
);
const accept = await Deno.readTextFile(
  new URL("../accept-contract-summary/index.ts", import.meta.url),
);

Deno.test("revision reissues the Contract Information Pack for the new CS", () => {
  assert(revised.includes("generate-contract-information-pack"));
  assert(revised.includes("for_contract_summary_id: created.id"));
  assert(revised.includes("contract_information_reissue_failed"));
});

Deno.test("revision mirrors the acceptance snapshot-integrity check", () => {
  assert(revised.includes("contract_information_not_current_for_revision"));
  assert(revised.includes('.order("version", { ascending: false })'));
  assert(revised.includes('"superseded", "cancelled", "void_manual_review"'));
});

Deno.test("revision fails closed by voiding the new CS, never deleting it", () => {
  assert(revised.includes("const voidRevision ="));
  assert(revised.includes('document_status: "void_manual_review"'));
  assert(revised.includes("public_token_hash: null"));
  assert(!/\.from\("contract_summaries"\)\s*\.delete\(/.test(revised));
  for (const why of [
    "pdf_generation_failed",
    "contract_information_reissue_failed",
    "contract_information_missing_after_generation",
    "contract_information_bound_to_other_summary",
    "contract_information_link_failed",
    "contract_information_pdf_missing",
    "contract_information_not_current_for_revision",
  ]) {
    assert(revised.includes(`voidRevision("${why}")`), `missing fail-closed path: ${why}`);
  }
});

Deno.test("revision never relinks or supersedes an accepted pack", () => {
  assert(revised.includes("contract_information_bound_to_other_summary"));
  assert(revised.includes('.neq("document_status", "accepted")'));
  assert(packFn.includes('.neq("document_status", "accepted")'));
});

Deno.test("pack generator only reuses packs pairable with the requested CS", () => {
  assert(packFn.includes("for_contract_summary_id"));
  assert(packFn.includes("const pairable ="));
  assert(packFn.includes("accepted && pairable(accepted)"));
  assert(packFn.includes("contract_summary_id: forCsId"));
  assert(packFn.includes("supersedes_id: supersedesId"));
});

Deno.test("acceptance mismatch check is still present and unmodified in intent", () => {
  assertEquals(accept.includes("contract_information_mismatch"), true);
  assert(accept.includes("cip.contract_summary_id !== cs.id"));
});

Deno.test("revised CS carries router overrides and references both documents", () => {
  assert(revised.includes("router_option: RouterOptionSchema.optional()"));
  assert(revised.includes("router_charge: z.number().min(0)"));
  assert(revised.includes("selected_addons: z.array(AddonSchema)"));
  assert(!revised.includes("stays exactly as it was"));
  assert(revised.includes("What has not changed"));
  assert(revised.includes("Contract Information"));
});
