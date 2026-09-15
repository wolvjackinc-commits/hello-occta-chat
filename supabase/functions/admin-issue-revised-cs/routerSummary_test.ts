import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normaliseRouterOption,
  describeRouterSelection,
  routerEquipmentLine,
} from "../_shared/routerSummary.ts";

Deno.test("normalises legacy oneOff and modern one_off shapes", () => {
  assertEquals(normaliseRouterOption({ option: "standard", label: "Standard WiFi 6 router", payment_type: "one_off", monthly: 0, oneOff: 94.99 })?.one_off, 94.99);
  assertEquals(normaliseRouterOption({ option: "standard", label: "Standard WiFi 6 router", payment_type: "one_off", monthly: 0, one_off: 94.99 })?.one_off, 94.99);
  assertEquals(normaliseRouterOption(null), null);
  assertEquals(normaliseRouterOption({}), null);
});

Deno.test("describes a monthly router selection with the monthly amount", () => {
  assertEquals(
    describeRouterSelection({ option: "standard", label: "Standard WiFi 6 router", payment_type: "monthly", monthly: 4.99, one_off: 0 }, 0),
    "Standard WiFi 6 router — £4.99/month incl. VAT",
  );
});

Deno.test("describes a one-off router selection and own-router choice", () => {
  assertEquals(
    describeRouterSelection({ option: "standard", label: "Standard WiFi 6 router", payment_type: "one_off", monthly: 0, one_off: 94.99 }, 94.99),
    "Standard WiFi 6 router — £94.99 one-off incl. VAT",
  );
  assertEquals(
    describeRouterSelection({ option: "own", label: "Bring your own router", payment_type: "none", monthly: 0, one_off: 0 }, 0),
    "Bring your own router — no OCCTA router charge",
  );
});

Deno.test("PDF equipment wording reflects the stored selection", () => {
  assertEquals(
    routerEquipmentLine({ option: "standard", label: "Standard WiFi 6 router", payment_type: "monthly", monthly: 4.99, one_off: 0 }, 0),
    "Standard WiFi 6 router supplied by OCCTA — recurring charge £4.99 per month incl. VAT, included in your monthly price.",
  );
  assertEquals(
    routerEquipmentLine({ option: "own", label: "Bring your own router", payment_type: "none", monthly: 0, one_off: 0 }, 0),
    "No router is included. You may use your own compatible router; we provide the connection settings needed.",
  );
  // Legacy rows with no router_option keep the previous behaviour.
  assertEquals(
    routerEquipmentLine(null, 94.99),
    "Router supplied by OCCTA — one-off charge £94.99 incl. VAT.",
  );
});
