import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

// Admin/compliance only. Appends a complaint_event and (optionally) advances complaint status,
// including the deadlock action. complaint_events stay append-only (DB trigger enforces it).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin", "compliance_admin", "support_agent"]);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);

  const body = await req.json().catch(() => ({}));
  const complaintId = String(body.complaint_id ?? "");
  const eventType = String(body.event_type ?? "").slice(0, 64);
  const title = String(body.title ?? "").trim().slice(0, 200);
  const note = String(body.note ?? "").trim().slice(0, 4000);
  const visibility = body.visibility === "internal" ? "internal" : "customer";
  const newStatus = body.new_status ? String(body.new_status).slice(0, 32) : null;
  const issueDeadlock = body.issue_deadlock === true;

  if (!complaintId || !eventType || !title) return jsonResponse({ error: "invalid_input" }, 400);

  const svc = getServiceClient();

  // Confirm complaint exists
  const { data: existing, error: fetchErr } = await svc.from("complaints")
    .select("id, status").eq("id", complaintId).maybeSingle();
  if (fetchErr || !existing) return jsonResponse({ error: "complaint_not_found" }, 404);

  const { error: eventErr } = await svc.from("complaint_events").insert({
    complaint_id: complaintId,
    event_type: eventType,
    title,
    details: note ? { note } : {},
    actor_type: "staff",
    actor_id: staff.userId,
    visibility,
  });
  if (eventErr) return jsonResponse({ error: "event_insert_failed", detail: eventErr.message }, 500);

  // Optional status update / deadlock
  let didDeadlock = false;
  const update: Record<string, unknown> = {};
  if (issueDeadlock) {
    update.status = "deadlock_issued";
    update.deadlock_issued_at = new Date().toISOString();
    didDeadlock = true;
  } else if (newStatus) {
    update.status = newStatus;
  }
  if (Object.keys(update).length > 0) {
    await svc.from("complaints").update(update).eq("id", complaintId);
  }

  await svc.rpc("log_event", {
    _actor_type: "staff",
    _event_type: didDeadlock ? "complaint_deadlock_issued" : "complaint_event_added",
    _title: didDeadlock ? "Deadlock letter issued" : "Complaint event added",
    _source_module: "complaints",
    _details: { complaint_id: complaintId, event_type: eventType, new_status: update.status ?? null },
    _complaint_id: complaintId,
    _severity: didDeadlock ? "warning" : "info",
  });

  return jsonResponse({ ok: true, deadlock: didDeadlock, status: update.status ?? existing.status });
});