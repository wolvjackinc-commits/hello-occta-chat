// Admin-only reconciliation CSV upload for a scheduled job or the admin UI.
// Does not deploy from the existing GitHub Actions path filters.
import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { applyImport, buildSyncPlan, executeSyncPlan, loadReconState, FILE_KINDS, type FileKind } from "../_shared/paymentReconEngine.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => null) as { file_kind?: string; file_name?: string; csv_text?: string } | null;
  const fileKind = body?.file_kind as FileKind | undefined;
  if (!fileKind || !FILE_KINDS.includes(fileKind) || !body?.csv_text) {
    return jsonResponse({ error: "file_kind and csv_text are required" }, 400);
  }

  const supabase = getServiceClient();
  const previous = await loadReconState(supabase);
  const result = await applyImport(previous, fileKind, {
    csvText: body.csv_text,
    fileName: body.file_name || "upload.csv",
    importedBy: auth.userId,
    importedByEmail: null,
    importedAt: new Date().toISOString(),
  });
  if (result.errors.length) return jsonResponse({ error: "invalid_csv", errors: result.errors, warnings: result.warnings }, 400);
  await executeSyncPlan(supabase, buildSyncPlan(previous, result.state));
  return jsonResponse({
    ok: true,
    row_count: result.rowCount,
    warnings: result.warnings,
    note: "Stored on reconciliation tables only. Invoices were not changed and no email was sent.",
  });
});
