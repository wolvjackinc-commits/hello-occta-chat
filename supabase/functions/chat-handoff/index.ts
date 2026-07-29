// Human handoff for the floating chat widget.
// Creates/updates a chat_conversations row and seeds the transcript so
// admins can pick it up in the live chat console. A DB trigger fires the
// admin email when status flips to 'human_requested'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface HandoffPayload {
  sessionId: string;
  reason?: string;
  summary?: string;
  lastMessage?: string;
  customerName?: string;
  customerEmail?: string;
  transcript?: Array<{ role: string; content: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  // Best-effort user id from the bearer token.
  let userId: string | null = null;
  try {
    const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (auth) {
      const { data } = await svc.auth.getUser(auth);
      userId = data.user?.id ?? null;
    }
  } catch { /* ignore */ }

  let body: HandoffPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = String(body.sessionId || "").slice(0, 200);
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "session_id_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = String(body.summary || body.lastMessage || "Customer requested a human advisor").slice(0, 2000);
  const reason = String(body.reason || "requested_human").slice(0, 120);

  // Enrich with profile if signed in.
  let customerName = body.customerName?.slice(0, 200) || null;
  let customerEmail = body.customerEmail?.slice(0, 200) || null;
  if (userId && (!customerName || !customerEmail)) {
    const { data: profile } = await svc
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (profile) {
      customerName = customerName || (profile.full_name as string) || null;
      customerEmail = customerEmail || (profile.email as string) || null;
    }
  }

  // Upsert conversation by session_id.
  const { data: existing } = await svc
    .from("chat_conversations")
    .select("id, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  let convId: string;
  if (existing) {
    convId = existing.id as string;
    await svc
      .from("chat_conversations")
      .update({
        status: "awaiting_human",
        handoff_reason: reason,
        summary,
        user_id: userId ?? undefined,
        customer_name: customerName ?? undefined,
        customer_email: customerEmail ?? undefined,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", convId);
  } else {
    const { data: inserted, error } = await svc
      .from("chat_conversations")
      .insert({
        session_id: sessionId,
        user_id: userId,
        customer_name: customerName,
        customer_email: customerEmail,
        status: "awaiting_human",
        handoff_reason: reason,
        summary,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return new Response(JSON.stringify({ error: "conversation_insert_failed", details: error?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    convId = inserted.id as string;
  }

  // Seed transcript rows.
  const transcript = Array.isArray(body.transcript) ? body.transcript.slice(-30) : [];
  if (transcript.length) {
    const rows = transcript
      .map((m) => ({
        conversation_id: convId,
        role: m.role === "user" ? "customer" : m.role === "assistant" ? "bot" : "system",
        content: String(m.content || "").slice(0, 4000),
      }))
      .filter((r) => r.content);
    if (rows.length) {
      await svc.from("chat_messages").insert(rows);
    }
  }

  // System message announcing handoff.
  await svc.from("chat_messages").insert({
    conversation_id: convId,
    role: "system",
    content: `Customer requested a human advisor. Reason: ${reason}.`,
  });

  return new Response(JSON.stringify({ ok: true, conversationId: convId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});