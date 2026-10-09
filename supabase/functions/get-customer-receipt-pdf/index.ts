import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return respond({ error: "unauthorized" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: auth, error: authError } = await db.auth.getUser(bearer);
  if (authError || !auth.user) return respond({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => null) as { receipt_id?: string } | null;
  const id = body?.receipt_id;
  if (!id || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    return respond({ error: "invalid_receipt_id" }, 400);
  }
  const { data: receipt, error } = await db.from("receipts")
    .select("id, user_id, pdf_storage_key").eq("id", id).maybeSingle();
  if (error) return respond({ error: "receipt_lookup_failed" }, 500);
  if (!receipt || receipt.user_id !== auth.user.id) return respond({ error: "not_found" }, 404);
  if (!receipt.pdf_storage_key ||
      !receipt.pdf_storage_key.startsWith(auth.user.id + "/receipts/")) {
    return respond({ error: "archived_pdf_missing" }, 404);
  }
  const { data: link, error: signedError } = await db.storage
    .from("invoice-pdfs").createSignedUrl(receipt.pdf_storage_key, 120);
  if (signedError || !link?.signedUrl) return respond({ error: "link_failed" }, 502);
  return respond({ url: link.signedUrl, expires_in_seconds: 120 });
});
