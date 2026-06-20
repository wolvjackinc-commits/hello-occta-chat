// Admin actions over chat transcripts:
//  - email_to_customer: emails the full transcript to the customer linked to the session
//  - escalate_to_ticket: creates a support_tickets record + communication_thread seeded with the transcript
import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

type ChatRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  message_type: string;
  message_content: string;
  created_at: string;
};

function renderTranscriptText(rows: ChatRow[]): string {
  return rows
    .map((r) => {
      const who = r.message_type === "user" ? "Customer" : "IRA";
      return `[${r.created_at}] ${who}: ${r.message_content}`;
    })
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const staff = await requireStaff(req, ["admin", "super_admin", "sales_agent"]);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const sessionId = String(body.session_id ?? "");
  if (!sessionId) return jsonResponse({ error: "session_id_required" }, 400);

  const svc = getServiceClient();
  const { data: rows, error: rowsErr } = await svc
    .from("chat_analytics")
    .select("id, session_id, user_id, message_type, message_content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (rowsErr || !rows?.length) return jsonResponse({ error: "no_messages" }, 404);

  const userId = rows.find((r) => r.user_id)?.user_id ?? null;
  const transcript = renderTranscriptText(rows as ChatRow[]);

  if (action === "email_to_customer") {
    if (!userId) return jsonResponse({ error: "session_has_no_customer" }, 400);
    const { data: prof } = await svc
      .from("profiles").select("email, full_name").eq("id", userId).single();
    if (!prof?.email) return jsonResponse({ error: "customer_has_no_email" }, 400);

    const resp = await svc.functions.invoke("send-email", {
      body: {
        type: "custom_admin",
        to: prof.email,
        data: {
          subject: "Your chat transcript with Occta",
          message:
            `Hi ${prof.full_name ?? ""},\n\nAs requested, here is the full transcript of your recent chat with our assistant (IRA).\n\n----- TRANSCRIPT -----\n${transcript}\n----- END -----\n\nIf anything still needs attention, just reply to this email.`,
          customer_name: prof.full_name ?? "",
        },
        logToCommunications: true,
        userId,
      },
    });
    if (resp.error) return jsonResponse({ error: resp.error.message }, 500);
    return jsonResponse({ ok: true });
  }

  if (action === "escalate_to_ticket") {
    if (!userId) return jsonResponse({ error: "session_has_no_customer" }, 400);
    const subject = `Escalated chat: ${sessionId.slice(0, 8)}`;
    const { data: ticket, error: tErr } = await svc
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject,
        description: transcript.slice(0, 5000),
        category: "chat_escalation",
        priority: "high",
        status: "open",
      })
      .select("id").single();
    if (tErr || !ticket) return jsonResponse({ error: "ticket_create_failed" }, 500);

    const { data: thread } = await svc.from("communication_threads").insert({
      customer_id: userId,
      subject: `Ticket: ${subject}`,
      channel: "chat",
      status: "open",
      related_ticket_id: ticket.id,
    }).select("id").single();

    if (thread?.id) {
      await svc.from("communication_messages").insert({
        thread_id: thread.id,
        direction: "inbound",
        channel: "chat",
        sender_type: "customer",
        sender_id: userId,
        subject,
        body: transcript,
        metadata_json: { session_id: sessionId, escalated_by: staff.userId },
      });
    }

    await svc.rpc("log_event", {
      _actor_type: "admin",
      _event_type: "chat_escalated_to_ticket",
      _title: "Chat escalated to ticket",
      _source_module: "support",
      _details: { session_id: sessionId, ticket_id: ticket.id, by: staff.userId },
      _ticket_id: ticket.id,
    });

    return jsonResponse({ ok: true, ticket_id: ticket.id });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});