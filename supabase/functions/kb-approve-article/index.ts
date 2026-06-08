import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin", "compliance_admin"]);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);

  const { article_id, action } = await req.json().catch(() => ({}));
  if (!article_id || !["approve","archive","draft"].includes(action)) {
    return jsonResponse({ error: "bad_request" }, 400);
  }

  const svc = getServiceClient();
  const patch: Record<string, unknown> = { status: action === "approve" ? "approved" : action === "archive" ? "archived" : "draft" };
  if (action === "approve") {
    patch.approved_by = staff.userId;
    patch.approved_at = new Date().toISOString();
  }
  const { data, error } = await svc.from("kb_articles").update(patch).eq("id", article_id)
    .select("id, title, status, version").single();
  if (error || !data) return jsonResponse({ error: "update_failed" }, 500);

  await svc.rpc("log_event", {
    _actor_type: "admin",
    _event_type: action === "approve" ? "kb_article_approved" : action === "archive" ? "kb_article_archived" : "kb_article_created",
    _title: `KB article ${action}d`,
    _source_module: "knowledge_base",
    _details: { article_id: data.id, version: data.version },
  });

  return jsonResponse({ ok: true, status: data.status });
});