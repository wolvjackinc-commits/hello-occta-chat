import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return json(401, { error: "Missing token" });

  const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await authed.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });

  const svc = createClient(supabaseUrl, serviceRole);
  const admin = (await svc.rpc("has_role", { _user_id: userData.user.id, _role: "admin" })).data === true
    || (await svc.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" })).data === true;
  if (!admin) return json(403, { error: "Forbidden" });

  let body: { path?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const path = String(body.path || "").trim();
  if (!path) return json(400, { error: "path required" });

  const { data: scan } = await svc
    .from("chat_attachment_scans")
    .select("status, reasons")
    .eq("path", path)
    .maybeSingle();

  if (!scan) return json(409, { error: "not_scanned", message: "File has not been scanned yet." });
  if (scan.status === "quarantined" && !body.force) {
    return json(403, { error: "quarantined", reasons: scan.reasons });
  }
  if (scan.status === "error" && !body.force) {
    return json(409, { error: "scan_error", reasons: scan.reasons });
  }

  const signed = await svc.storage.from("chat-attachments").createSignedUrl(path, 60 * 10);
  if (signed.error || !signed.data) return json(500, { error: signed.error?.message || "sign_failed" });

  await svc.from("audit_logs").insert({
    action: "chat_attachment_download",
    entity: "chat_attachment",
    metadata: { path, forced: !!body.force, status: scan.status, by: userData.user.id },
  });

  return json(200, { url: signed.data.signedUrl, status: scan.status, reasons: scan.reasons });
});