// Confirmed-action executor for the OCCTA AI Copilot.
// Never trusts the browser payload. Re-validates JWT + admin role + target record,
// then calls the existing safe endpoint that staff already use.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { safeJson } from "../_shared/aiSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ActionType =
  | "confirm_service_live"
  | "mark_payment_received"
  | "cancel_service"
  | "lifecycle_transition"
  | "create_admin_task"
  | "create_internal_note";

interface ExecuteRequest {
  action_type: ActionType;
  target_id: string;
  details?: Record<string, unknown>;
  confirmed: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // 2) Verify admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Admin role required" }, 403);

    // 3) Parse body
    const body = (await req.json()) as ExecuteRequest;
    if (!body?.action_type || !body?.target_id) {
      return json({ error: "Missing action_type or target_id" }, 400);
    }
    if (body.confirmed !== true) {
      return json({ error: "Explicit confirmed=true required" }, 400);
    }

    // 4) Re-fetch target, dispatch per action
    let result: unknown;
    let auditEntity = "service";
    switch (body.action_type) {
      case "confirm_service_live": {
        const { data: svc } = await supabase.from("services")
          .select("id, status").eq("id", body.target_id).maybeSingle();
        if (!svc) return json({ error: "Service not found" }, 404);
        if (svc.status === "active") {
          result = { ok: true, message: "Service is already active.", noop: true };
        } else {
          // Delegate to existing safe edge function so business rules / triggers run.
          const { data, error } = await supabase.functions.invoke("confirm-service-live", {
            body: { service_id: body.target_id },
            headers: { Authorization: authHeader },
          });
          if (error) return json({ error: error.message }, 502);
          result = data;
        }
        break;
      }
      case "create_admin_task": {
        auditEntity = "ticket_internal_note";
        const { data, error } = await supabase.from("admin_tasks").insert({
          title: String(body.details?.title ?? "Admin task (AI prepared)").slice(0, 200),
          description: String(body.details?.description ?? "").slice(0, 4000),
          priority: String(body.details?.priority ?? "medium"),
          status: "open",
          source: "ai_assistant",
          related_user_id: body.details?.related_user_id ?? null,
          assigned_to: userId,
        }).select("id").single();
        if (error) return json({ error: error.message }, 400);
        result = { ok: true, task_id: data.id };
        break;
      }
      case "create_internal_note": {
        auditEntity = "ticket_internal_note";
        const ticketId = String(body.details?.ticket_id ?? "");
        if (!ticketId) return json({ error: "ticket_id required in details" }, 400);
        const { data, error } = await supabase.from("ticket_internal_notes").insert({
          ticket_id: ticketId,
          author_id: userId,
          body: String(body.details?.body ?? "").slice(0, 4000),
        }).select("id").single();
        if (error) return json({ error: error.message }, 400);
        result = { ok: true, note_id: data.id };
        break;
      }
      case "mark_payment_received":
      case "cancel_service":
      case "lifecycle_transition":
        // These are deliberately NOT auto-executed even after confirmation in this first cut.
        // Staff must still drive them from the existing admin UI. We log the request as an
        // admin task so it appears in the work queue.
        await supabase.from("admin_tasks").insert({
          title: `AI-prepared: ${body.action_type} ${body.target_id}`,
          description: `Confirmed by admin ${userId}. Run via existing admin tools.\n\nDetails: ${safeJson(body.details ?? {})}`,
          priority: "high",
          status: "open",
          source: "ai_assistant",
        });
        result = {
          ok: true,
          message: "Recorded as a high-priority admin task. Please complete via the admin tools.",
          handoff: true,
        };
        break;
      default:
        return json({ error: "Unknown action_type" }, 400);
    }

    // 5) Audit
    await supabase.from("audit_logs").insert({
      action: "update",
      entity: auditEntity,
      entity_id: body.target_id,
      metadata: { source: "ai_copilot", action_type: body.action_type, admin_user_id: userId },
    });

    return json({ success: true, result });
  } catch (e) {
    console.error("ai-execute-action error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
