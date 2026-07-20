import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticket_id, event, message } = await req.json();
    if (!ticket_id || !event) {
      return new Response(JSON.stringify({ error: "ticket_id and event required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, subject, status, priority, user_id")
      .eq("id", ticket_id)
      .single();

    if (!ticket) {
      return new Response(JSON.stringify({ error: "ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, business_profile_id")
      .eq("id", ticket.user_id)
      .maybeSingle();

    // Honor per-user notification preferences for the ticket owner.
    // event: status_change -> email_status_changes ; attachment_uploaded -> email_attachments
    // message / priority_change / assignment always allowed (transactional replies).
    const emailPrefKey =
      event === "status_change" ? "email_status_changes" :
      event === "attachment_uploaded" ? "email_attachments" : null;

    let ownerAllowed = true;
    if (emailPrefKey) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select(emailPrefKey)
        .eq("user_id", ticket.user_id)
        .maybeSingle();
      // Default: status=on, attachments=off (matches table defaults).
      const defaultVal = emailPrefKey === "email_status_changes";
      ownerAllowed = prefs ? Boolean((prefs as any)[emailPrefKey]) : defaultVal;
    }

    const recipients = new Set<string>();
    if (ownerAllowed && profile?.email) recipients.add(profile.email);

    if (profile?.business_profile_id) {
      const { data: contacts } = await supabase
        .from("business_contacts")
        .select("email, receives_updates")
        .eq("business_profile_id", profile.business_profile_id)
        .eq("receives_updates", true);
      for (const c of contacts ?? []) if ((c as any).email) recipients.add((c as any).email);
    }

    // In-app notification for ticket owner (respect in-app prefs)
    const inAppPrefKey =
      event === "status_change" ? "in_app_status_changes" :
      event === "attachment_uploaded" ? "in_app_attachments" : null;
    let inAppAllowed = true;
    if (inAppPrefKey) {
      const { data: prefs2 } = await supabase
        .from("notification_preferences")
        .select(inAppPrefKey)
        .eq("user_id", ticket.user_id)
        .maybeSingle();
      inAppAllowed = prefs2 ? Boolean((prefs2 as any)[inAppPrefKey]) : true;
    }
    if (inAppAllowed) {
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        type: `ticket.${event}`,
        title: `Ticket update: ${ticket.subject}`,
        body: message ? String(message).slice(0, 240) : `Status: ${ticket.status}`,
        link: `/business/support?ticket=${ticket.id}`,
      } as any);
    }

    const subject = `[Ticket ${ticket.id.slice(0, 8)}] ${ticket.subject}`;
    const label = ({
      status_change: "Status updated",
      message: "New reply",
      attachment_uploaded: "New attachment",
      priority_change: "Priority updated",
      assignment: "Assignment updated",
    } as Record<string, string>)[event] ?? "Ticket update";

    const safeMsg = message ? String(message).replace(/</g, "&lt;") : "";
    const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="font-family:'Space Grotesk',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.02em;">${label}</h2>
      <p><strong>Ticket:</strong> ${ticket.subject}</p>
      <p><strong>Status:</strong> ${ticket.status} &middot; <strong>Priority:</strong> ${ticket.priority}</p>
      ${safeMsg ? `<div style="border-left:4px solid #000;padding:8px 12px;margin:16px 0;background:#f6f6f6;">${safeMsg}</div>` : ""}
      <p><a href="https://occta.co.uk/business/support?ticket=${ticket.id}" style="display:inline-block;background:#000;color:#fff;padding:10px 18px;text-decoration:none;">Open ticket</a></p>
    </div>`;

    const sent: any[] = [];
    for (const to of recipients) {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          type: "custom_admin",
          to,
          data: { subject, message_html: html, message_text: `${label} - ${ticket.subject}` },
          logToCommunications: true,
          userId: ticket.user_id,
        }),
      });
      sent.push({ to, ok: r.ok });
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});