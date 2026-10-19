import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return response({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return response({ error: "unauthorized" }, 401);

  let invoiceId: unknown;
  try { invoiceId = (await req.json())?.invoice_id; }
  catch { return response({ error: "invalid_json" }, 400); }
  if (typeof invoiceId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(invoiceId)) {
    return response({ error: "invalid_invoice_id" }, 400);
  }

  // Query is performed with service credentials, so OWNERSHIP is checked
  // explicitly. The customer must never see another customer's documents.
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, user_id, status, pdf_storage_key")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError) return response({ error: "invoice_lookup_failed" }, 500);
  if (!invoice || invoice.user_id !== auth.user.id) {
    return response({ error: "invoice_not_found" }, 404);
  }
  if (["draft", "cancelled"].includes(invoice.status)) {
    return response({ error: "invoice_not_issued" }, 409);
  }
  if (!invoice.pdf_storage_key || !invoice.pdf_storage_key.startsWith(auth.user.id + "/")) {
    return response({ error: "stored_pdf_missing" }, 404);
  }

  const { data: link, error: signedError } = await supabase.storage
    .from("invoice-pdfs").createSignedUrl(invoice.pdf_storage_key, 120);
  if (signedError || !link?.signedUrl) {
    return response({ error: "pdf_link_failed" }, 502);
  }
  return response({ url: link.signedUrl, expires_in_seconds: 120 });
});
