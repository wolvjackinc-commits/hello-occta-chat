import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin", "compliance_admin"]);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);

  const { letter_id } = await req.json().catch(() => ({}));
  if (!letter_id) return jsonResponse({ error: "missing_letter_id" }, 400);

  const svc = getServiceClient();
  const { data: letter, error } = await svc.from("complaint_letters")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", letter_id).eq("status", "draft")
    .select("id, complaint_id, letter_type, subject").single();

  if (error || !letter) return jsonResponse({ error: "not_found_or_already_sent" }, 404);

  await svc.from("complaint_events").insert({
    complaint_id: letter.complaint_id,
    event_type: letter.letter_type === "deadlock" ? "deadlock_issued" : "admin_response",
    title: `${letter.letter_type} letter sent`,
    actor_type: "admin",
    actor_id: staff.userId,
    visibility: "customer",
    details: { letter_id: letter.id },
  });

  if (letter.letter_type === "deadlock") {
    await svc.from("complaints").update({ status: "deadlock_issued" }).eq("id", letter.complaint_id);
  }

  await svc.rpc("log_event", {
    _actor_type: "admin",
    _event_type: letter.letter_type === "deadlock" ? "complaint_deadlock_issued" : "complaint_event_added",
    _title: `${letter.letter_type} letter sent`,
    _source_module: "complaints",
    _details: { complaint_id: letter.complaint_id, letter_id: letter.id, letter_type: letter.letter_type },
  });

  return jsonResponse({ ok: true });
});