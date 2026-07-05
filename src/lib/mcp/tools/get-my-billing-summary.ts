import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_my_billing_summary",
  title: "Get my billing summary",
  description: "Return the signed-in customer's billing configuration: billing day, billing mode, VAT setting, and Direct Debit status. Read-only. Does not include costs, margins or supplier data.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const client = sb(ctx);
    const userId = ctx.getUserId();

    const [{ data: settings }, { data: dd }] = await Promise.all([
      client
        .from("billing_settings")
        .select("billing_mode, billing_day, vat_enabled_default, vat_rate_default, next_invoice_date, payment_terms_days, auto_pay_enabled, preferred_payment_method, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      client
        .from("dd_mandates")
        .select("status, mandate_reference, bank_last4, account_holder_name, provider, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const summary = {
      billing: settings ?? null,
      direct_debit: dd ? {
        status: dd.status,
        active: dd.status === "active",
        mandate_reference: dd.mandate_reference,
        bank_last4: dd.bank_last4,
        account_holder_name: dd.account_holder_name,
        provider: dd.provider,
      } : null,
    };
    return { content: [{ type: "text", text: JSON.stringify(summary) }], structuredContent: summary };
  },
});