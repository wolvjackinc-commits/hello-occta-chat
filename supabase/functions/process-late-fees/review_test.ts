import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildOverdueReviewTask, isReviewableOverdue } from "./review.ts";

const now = new Date("2026-10-07T09:00:00Z");
const inv = { id: "x", invoice_number: "INV-1", user_id: null, total: 34.99, due_date: "2026-09-20", status: "sent" };

Deno.test("overdue beyond 7 days is reviewable", () => assert(isReviewableOverdue(inv, now)));
Deno.test("recent or zero invoices are not", () => {
  assert(!isReviewableOverdue({ ...inv, due_date: "2026-10-04" }, now));
  assert(!isReviewableOverdue({ ...inv, total: 0 }, now));
});
Deno.test("task is review-only: no fee/suspension fields, stable title for dedupe", () => {
  const t = buildOverdueReviewTask(inv, now);
  assertEquals(t.title, "Overdue invoice review — INV-1");
  assertEquals(Object.keys(t).sort(), ["description", "priority", "related_customer_id", "status", "title"]);
  assert(!/£5|£25|reconnection/i.test(t.description));
});
