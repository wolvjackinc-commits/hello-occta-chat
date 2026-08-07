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
  mode?: "handoff" | "log" | "customer_message" | "poll" | "end" | "email_transcript";
  reason?: string;
  summary?: string;
  lastMessage?: string;
  customerName?: string;
  customerEmail?: string;
  message?: string;
  since?: string;
  transcript?: Array<{ role: string; content: string }>;
}

const jsonOut = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
  const isLogOnly = body.mode === "log";

  // ---- Live-session modes (customer side) ----
  if (body.mode === "customer_message" || body.mode === "poll" || body.mode === "end" || body.mode === "email_transcript") {
    const { data: conv } = await svc
      .from("chat_conversations")
      .select("id, status, assigned_admin_id, customer_email, customer_name, user_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!conv) return jsonOut(404, { error: "conversation_not_found" });
    const convId = conv.id as string;

    if (body.mode === "customer_message") {
      const content = String(body.message || "").slice(0, 4000).trim();
      if (!content) return jsonOut(400, { error: "message_required" });
      await svc.from("chat_messages").insert({ conversation_id: convId, role: "user", content, attachments: [] });
      await svc.from("chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
      return jsonOut(200, { ok: true });
    }

    if (body.mode === "poll") {
      const since = body.since && !Number.isNaN(Date.parse(body.since)) ? body.since : new Date(Date.now() - 60_000).toISOString();
      const { data: rows } = await svc
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", convId)
        .in("role", ["admin", "system"])
        .gt("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50);
      return jsonOut(200, {
        ok: true,
        status: conv.status,
        assigned: Boolean(conv.assigned_admin_id),
        messages: rows ?? [],
        serverTime: new Date().toISOString(),
      });
    }

    if (body.mode === "end") {
      await svc.from("chat_conversations").update({ status: "resolved" }).eq("id", convId);
      await svc.from("chat_messages").insert({
        conversation_id: convId,
        role: "system",
        content: "Customer ended the chat.",
        attachments: [],
      });
      return jsonOut(200, { ok: true });
    }

    // email_transcript
    const to = String(body.customerEmail || conv.customer_email || "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return jsonOut(400, { error: "valid_email_required" });
    const { data: rows } = await svc
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(500);
    const transcriptText = (rows ?? [])
      .map((r) => {
        const who = r.role === "user" ? "You" : r.role === "admin" ? "OCCTA advisor" : r.role === "assistant" ? "Ollie (OCCTA Assist)" : "System";
        return `[${new Date(r.created_at as string).toLocaleString("en-GB", { timeZone: "Europe/London" })}] ${who}: ${r.content}`;
      })
      .join("\n\n");
    const emailResp = await svc.functions.invoke("send-email", {
      body: {
        type: "custom_admin",
        to,
        data: {
          subject: "Your OCCTA chat transcript",
          message: `Hi ${conv.customer_name ?? "there"},\n\nHere is a copy of your recent OCCTA chat.\n\n----- TRANSCRIPT -----\n${transcriptText}\n----- END -----\n\nIf anything still needs attention, just reply to this email.`,
          customer_name: conv.customer_name ?? "",
        },
        logToCommunications: Boolean(conv.user_id),
        userId: conv.user_id ?? undefined,
      },
    });
    if (emailResp.error) return jsonOut(500, { error: "email_failed", details: emailResp.error.message });
    return jsonOut(200, { ok: true });
  }

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
    const update: Record<string, unknown> = {
      user_id: userId ?? undefined,
      customer_name: customerName ?? undefined,
      customer_email: customerEmail ?? undefined,
      last_message_at: new Date().toISOString(),
    };
    if (!isLogOnly) {
      // Only an explicit handoff flips the conversation into the human queue.
      update.status = "awaiting_human";
      update.handoff_reason = reason;
      update.summary = summary;
    }
    await svc.from("chat_conversations").update(update).eq("id", convId);
  } else {
    const { data: inserted, error } = await svc
      .from("chat_conversations")
      .insert({
        session_id: sessionId,
        user_id: userId,
        customer_name: customerName,
        customer_email: customerEmail,
        status: isLogOnly ? "ai" : "awaiting_human",
        handoff_reason: isLogOnly ? null : reason,
        summary: isLogOnly ? summary : summary,
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
        // chat_messages.role only allows user | assistant | admin | system.
        role: m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : "system",
        content: String(m.content || "").slice(0, 4000),
        attachments: [],
      }))
      .filter((r) => r.content);
    if (rows.length) {
      await svc.from("chat_messages").insert(rows);
    }
  }

  if (isLogOnly) {
    // Live bot transcript logging — no handoff, no admin alert.
    return new Response(JSON.stringify({ ok: true, conversationId: convId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // System message announcing handoff.
  await svc.from("chat_messages").insert({
    conversation_id: convId,
    role: "system",
    content: `Customer requested a human advisor. Reason: ${reason}.`,
    attachments: [],
  });

  return new Response(JSON.stringify({ ok: true, conversationId: convId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});