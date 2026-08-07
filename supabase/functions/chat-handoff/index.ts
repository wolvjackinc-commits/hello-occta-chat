// Human handoff and secure attachment bridge for the OCCTA customer companion.
// Keeps the bot conversation and the human advisor thread in one conversation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AttachmentPayload = {
  path?: string;
  name?: string;
  size?: number;
  contentType?: string;
};

interface HandoffPayload {
  sessionId: string;
  mode?:
    | "handoff"
    | "log"
    | "customer_message"
    | "customer_attachment"
    | "customer_download"
    | "poll"
    | "end"
    | "email_transcript";
  reason?: string;
  summary?: string;
  lastMessage?: string;
  customerName?: string;
  customerEmail?: string;
  message?: string;
  since?: string;
  path?: string;
  attachments?: AttachmentPayload[];
  transcript?: Array<{ role: string; content: string }>;
}

const jsonOut = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeSession(value: unknown): string {
  const session = String(value || "").trim().slice(0, 200);
  return /^[a-zA-Z0-9-]{16,200}$/.test(session) ? session : "";
}

function safeAttachmentName(value: unknown, path: string): string {
  const fallback = path.split("/").pop() || "Attachment";
  return String(value || fallback).replace(/[\r\n]/g, " ").slice(0, 180);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonOut(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  let userId: string | null = null;
  try {
    const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (auth) {
      const { data } = await svc.auth.getUser(auth);
      userId = data.user?.id ?? null;
    }
  } catch {
    userId = null;
  }

  let body: HandoffPayload;
  try {
    body = await req.json();
  } catch {
    return jsonOut(400, { error: "invalid_json" });
  }

  const sessionId = safeSession(body.sessionId);
  if (!sessionId) return jsonOut(400, { error: "session_id_required" });

  const summary = String(body.summary || body.lastMessage || "Customer requested a human advisor").slice(0, 2000);
  const reason = String(body.reason || "requested_human").slice(0, 120);
  const isLogOnly = body.mode === "log";

  const liveModes = new Set([
    "customer_message",
    "customer_attachment",
    "customer_download",
    "poll",
    "end",
    "email_transcript",
  ]);

  if (body.mode && liveModes.has(body.mode)) {
    const { data: conv } = await svc
      .from("chat_conversations")
      .select("id, status, assigned_admin_id, customer_email, customer_name, user_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!conv) return jsonOut(404, { error: "conversation_not_found" });

    // A signed-in customer's thread requires the same authenticated user.
    // Guest threads remain bound to the high-entropy session id.
    if (conv.user_id && (!userId || conv.user_id !== userId)) {
      return jsonOut(403, { error: "conversation_access_denied" });
    }

    const convId = conv.id as string;

    if (body.mode === "customer_message") {
      const content = String(body.message || "").slice(0, 4000).trim();
      if (!content) return jsonOut(400, { error: "message_required" });
      await svc.from("chat_messages").insert({ conversation_id: convId, role: "user", content, attachments: [] });
      await svc.from("chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
      return jsonOut(200, { ok: true });
    }

    if (body.mode === "customer_attachment") {
      const requested = Array.isArray(body.attachments) ? body.attachments.slice(0, 3) : [];
      if (!requested.length) return jsonOut(400, { error: "attachment_required" });

      const attachments = requested.map((item) => {
        const path = String(item.path || "").trim();
        const allowedPrefix = userId ? `user/${userId}/` : `guest/${sessionId}/`;
        if (!path.startsWith(allowedPrefix) || !path.includes(`/${convId}/`)) {
          throw new Error("attachment_path_denied");
        }
        return {
          path,
          name: safeAttachmentName(item.name, path),
          size: Number.isFinite(Number(item.size)) ? Math.max(0, Number(item.size)) : undefined,
          contentType: String(item.contentType || "").slice(0, 160) || undefined,
        };
      });

      const paths = attachments.map((item) => item.path);
      const { data: scans, error: scanError } = await svc
        .from("chat_attachment_scans")
        .select("path, status")
        .in("path", paths);
      if (scanError) return jsonOut(500, { error: "attachment_scan_lookup_failed" });
      const scanMap = new Map((scans ?? []).map((row) => [row.path as string, row.status as string]));
      if (paths.some((path) => scanMap.get(path) !== "clean")) {
        return jsonOut(409, { error: "attachment_not_clean" });
      }

      const content = String(body.message || `Attachment: ${attachments[0].name}`).slice(0, 4000).trim();
      const { error } = await svc.from("chat_messages").insert({
        conversation_id: convId,
        role: "user",
        content: content || "Attachment",
        attachments,
      });
      if (error) return jsonOut(500, { error: "attachment_message_failed" });
      await svc.from("chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
      return jsonOut(200, { ok: true, attachments });
    }

    if (body.mode === "customer_download") {
      const path = String(body.path || "").trim();
      if (!path) return jsonOut(400, { error: "path_required" });

      const { data: rows } = await svc
        .from("chat_messages")
        .select("attachments")
        .eq("conversation_id", convId)
        .limit(500);
      const belongs = (rows ?? []).some((row) =>
        Array.isArray(row.attachments) && row.attachments.some((attachment: AttachmentPayload) => attachment?.path === path)
      );
      if (!belongs) return jsonOut(403, { error: "attachment_not_in_conversation" });

      const { data: scan } = await svc
        .from("chat_attachment_scans")
        .select("status")
        .eq("path", path)
        .maybeSingle();
      if (!scan || scan.status !== "clean") return jsonOut(409, { error: "attachment_unavailable" });

      const { data: signed, error } = await svc.storage.from("chat-attachments").createSignedUrl(path, 60 * 10);
      if (error || !signed?.signedUrl) return jsonOut(500, { error: "attachment_sign_failed" });
      return jsonOut(200, { ok: true, url: signed.signedUrl });
    }

    if (body.mode === "poll") {
      const since = body.since && !Number.isNaN(Date.parse(body.since))
        ? body.since
        : new Date(Date.now() - 60_000).toISOString();
      const { data: rows } = await svc
        .from("chat_messages")
        .select("id, role, content, attachments, created_at")
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

    const to = String(body.customerEmail || conv.customer_email || "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return jsonOut(400, { error: "valid_email_required" });
    const { data: rows } = await svc
      .from("chat_messages")
      .select("role, content, attachments, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(500);
    const transcriptText = (rows ?? [])
      .map((row) => {
        const who = row.role === "user" ? "You" : row.role === "admin" ? "OCCTA advisor" : row.role === "assistant" ? "Ollie (OCCTA Assist)" : "System";
        const attachmentNames = Array.isArray(row.attachments)
          ? row.attachments.map((item: AttachmentPayload) => safeAttachmentName(item.name, String(item.path || ""))).join(", ")
          : "";
        return `[${new Date(row.created_at as string).toLocaleString("en-GB", { timeZone: "Europe/London" })}] ${who}: ${row.content}${attachmentNames ? `\nAttachments: ${attachmentNames}` : ""}`;
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

  const { data: existing } = await svc
    .from("chat_conversations")
    .select("id, status, user_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing?.user_id && (!userId || existing.user_id !== userId)) {
    return jsonOut(403, { error: "conversation_access_denied" });
  }

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
        summary,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !inserted) return jsonOut(500, { error: "conversation_insert_failed", details: error?.message });
    convId = inserted.id as string;
  }

  const transcript = Array.isArray(body.transcript) ? body.transcript.slice(-30) : [];
  if (transcript.length) {
    const rows = transcript
      .map((message) => ({
        conversation_id: convId,
        role: message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : "system",
        content: String(message.content || "").slice(0, 4000),
        attachments: [],
      }))
      .filter((row) => row.content);
    if (rows.length) await svc.from("chat_messages").insert(rows);
  }

  if (isLogOnly) return jsonOut(200, { ok: true, conversationId: convId });

  await svc.from("chat_messages").insert({
    conversation_id: convId,
    role: "system",
    content: `Customer requested a human advisor. Reason: ${reason}.`,
    attachments: [],
  });

  return jsonOut(200, { ok: true, conversationId: convId });
});
