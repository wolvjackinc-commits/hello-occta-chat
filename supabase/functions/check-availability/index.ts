import { corsHeaders, jsonResponse, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import {
  verifyIcukAvailabilityForAddress,
  buildContractSpeedMatrix,
} from "../_shared/icukAvailability.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "check_availability", 10, 300))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const body = await req.json().catch(() => null);
  const address = body?.address;
  if (!address || typeof address !== "object") {
    return jsonResponse({ error: "full_address_required" }, 400);
  }

  try {
    const { exact_address, evidence } = await verifyIcukAvailabilityForAddress(address);

    const planSpeedMatrices: Record<string, unknown> = {};
    for (const bucket of evidence.eligible_occta_plans) {
      const matrix = buildContractSpeedMatrix(evidence, bucket);
      if (matrix.ok) planSpeedMatrices[bucket] = matrix.matrix;
    }

    const primaryProducts = evidence.products.filter(
      (p) => p.available && p.technology === evidence.primary_technology,
    );
    const maxDownload = Math.max(...primaryProducts.map(
      (p) => p.maximum_down_mbps ?? p.likely_down_mbps ?? 0,
    ), 0);
    const maxUpload = Math.max(...primaryProducts.map(
      (p) => p.maximum_up_mbps ?? p.likely_up_mbps ?? 0,
    ), 0);

    return jsonResponse({
      available: true,
      verifiedExactAddress: true,
      source: evidence.source,
      retrievedAt: evidence.retrieved_at,
      primaryTechnology: evidence.primary_technology,
      maxDownload,
      maxUpload,
      eligibleOcctaPlans: evidence.eligible_occta_plans,
      technologies: [...new Set(evidence.products.filter((p) => p.available).map((p) => p.technology))],
      products: evidence.products,
      exchange: evidence.exchange,
      addressReference: evidence.address_reference,
      exactAddress: exact_address,
      contractSpeedMatrices: planSpeedMatrices,
      evidence,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "availability_failed";
    const unavailable = code === "icuk_backend_not_configured" || code.startsWith("icuk_");
    console.error("[check-availability]", code);
    return jsonResponse({
      available: false,
      error: code,
      eligibleOcctaPlans: [],
      message: unavailable
        ? "We can’t verify supplier availability for this address right now. Your order cannot proceed until the network check succeeds."
        : "We couldn’t verify this exact address with the network. Contact OCCTA and we’ll check it manually.",
    }, unavailable ? 503 : 409);
  }
});
