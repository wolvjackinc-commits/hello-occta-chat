import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_my_router_status",
  title: "Get my router / activation readiness",
  description: "Return activation readiness and router/provisioning status for the signed-in customer's most recent order. Customer-safe fields only; excludes supplier refs.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const client = sb(ctx);
    const userId = ctx.getUserId();
    const { data: order } = await client
      .from("orders")
      .select("id, occta_order_number, status, lifecycle_status, expected_activation_date, actual_activation_date, plan_name")
      .or(`user_id.eq.${userId},customer_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return { content: [{ type: "text", text: "No order found for signed-in customer." }], structuredContent: { order: null, readiness: null } };
    const { data: pr } = await client
      .from("payment_requests")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: readiness } = pr?.id
      ? await client
          .from("provisioning_readiness")
          .select("installation_confirmed, router_confirmed, admin_review_complete, reviewer_notes, updated_at")
          .eq("payment_request_id", pr.id)
          .maybeSingle()
      : { data: null };
    const payload = { order, readiness: readiness ?? null };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});