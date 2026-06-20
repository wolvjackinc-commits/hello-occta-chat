import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AdjustmentLine {
  description: string;
  qty?: number;
  unit_price: number; // ex-VAT
  vat_rate?: number;
}

interface Body {
  invoice_id: string; // original invoice the adjustment relates to
  reason: string;
  lines: AdjustmentLine[];
  is_permanent_addition?: boolean; // if true, also create recurring add-on(s) for the service
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: userResp } = await userClient.auth.getUser();
    const user = userResp?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const body = (await req.json()) as Body;
    if (!body?.invoice_id || !body?.reason || !Array.isArray(body.lines) || body.lines.length === 0) {
      return new Response(JSON.stringify({ error: "invoice_id, reason and at least one line are required" }), { status: 400, headers: corsHeaders });
    }

    const { data: orig, error: origErr } = await admin
      .from("invoices")
      .select("id,user_id,service_id,order_id,currency,vat_enabled,vat_rate,invoice_number")
      .eq("id", body.invoice_id)
      .single();
    if (origErr || !orig) return new Response(JSON.stringify({ error: "Original invoice not found" }), { status: 404, headers: corsHeaders });

    // Build adjustment invoice totals
    let subtotal = 0;
    let vatTotal = 0;
    const lineRows = body.lines.map((l) => {
      const qty = l.qty && l.qty > 0 ? l.qty : 1;
      const ex = Number(l.unit_price) * qty;
      const vr = l.vat_rate ?? Number(orig.vat_rate ?? 20);
      const vat = orig.vat_enabled === false ? 0 : ex * (vr / 100);
      subtotal += ex;
      vatTotal += vat;
      return {
        description: l.description,
        qty,
        unit_price: Number(l.unit_price),
        vat_rate: vr,
        line_total: +(ex + vat).toFixed(2),
        metadata: { adjustment: true },
      };
    });
    const total = +(subtotal + vatTotal).toFixed(2);

    const issueDate = new Date().toISOString().slice(0, 10);
    const due = new Date(); due.setDate(due.getDate() + 14);

    // Generate adjustment invoice number ADJ-<orig>-<random>
    const adjNumber = `ADJ-${orig.invoice_number || orig.id.slice(0, 8)}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const { data: newInv, error: newInvErr } = await admin
      .from("invoices")
      .insert({
        invoice_number: adjNumber,
        user_id: orig.user_id,
        service_id: orig.service_id,
        order_id: orig.order_id,
        status: "sent",
        issue_date: issueDate,
        due_date: due.toISOString().slice(0, 10),
        currency: orig.currency || "GBP",
        subtotal: +subtotal.toFixed(2),
        vat_total: +vatTotal.toFixed(2),
        total,
        invoice_type: "adjustment",
        adjustment_of_invoice_id: orig.id,
        adjustment_reason: body.reason,
        is_permanent_addition: !!body.is_permanent_addition,
        vat_enabled: orig.vat_enabled,
        vat_rate: orig.vat_rate,
        notes: `Adjustment to invoice ${orig.invoice_number}. Reason: ${body.reason}`,
      })
      .select("id")
      .single();
    if (newInvErr || !newInv) {
      return new Response(JSON.stringify({ error: newInvErr?.message || "Failed to create adjustment" }), { status: 500, headers: corsHeaders });
    }

    await admin.from("invoice_lines").insert(
      lineRows.map((r) => ({ ...r, invoice_id: newInv.id })),
    );

    // Optionally add to recurring schedule
    const addonIds: string[] = [];
    if (body.is_permanent_addition && orig.service_id) {
      for (const l of body.lines) {
        const { data: addon } = await admin
          .from("recurring_billing_addons")
          .insert({
            user_id: orig.user_id,
            service_id: orig.service_id,
            description: l.description,
            amount_ex_vat: Number(l.unit_price),
            vat_rate: l.vat_rate ?? Number(orig.vat_rate ?? 20),
            source_invoice_id: newInv.id,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (addon?.id) addonIds.push(addon.id);
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "invoice.adjustment.created",
      target_table: "invoices",
      target_id: newInv.id,
      metadata: { original_invoice_id: orig.id, reason: body.reason, total, addon_ids: addonIds },
    });

    return new Response(
      JSON.stringify({ ok: true, invoice_id: newInv.id, total, addon_ids: addonIds }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), { status: 500, headers: corsHeaders });
  }
});