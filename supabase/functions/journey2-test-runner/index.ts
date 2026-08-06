/**
 * Journey 2 — the DEDICATED isolated test session API.
 *
 * This is the only entry point for isolated test journeys. It is reachable by
 * a server-validated administrator, or internally by the service role for
 * automated deployment verification. Anonymous and customer callers are always
 * rejected, whatever the public kill switch says, because this path writes to
 * `journey2_test_*` tables only.
 */
import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { loadJourneySettings } from "../_shared/journey2.ts";
import {
  createTestSession, loadTestSessionByToken, saveTestStep, prepareTestContract,
  acceptTestContract, submitTestOrder, getTestCompletion,
} from "../_shared/journey2TestPath.ts";

const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Server-side authorisation. `admin_test: true` from a browser is never trusted. */
export async function authoriseTestCaller(req: Request): Promise<
  { ok: true; actor: "admin" | "service"; userId: string | null } | { ok: false; status: number; error: string }
> {
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (SVC && auth === SVC) return { ok: true, actor: "service", userId: null };
  const staff = await requireStaff(req, ["admin", "super_admin"]);
  if ("userId" in staff) return { ok: true, actor: "admin", userId: staff.userId };
  return { ok: false, status: staff.status === 200 ? 403 : staff.status, error: staff.error ?? "forbidden" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authorised = await authoriseTestCaller(req);
  if (!authorised.ok) return jsonResponse({ error: authorised.error }, authorised.status);

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.action) return jsonResponse({ error: "validation" }, 400);

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);

  if (body.action === "start") {
    const created = await createTestSession(supabase, { testRunId: body.test_run_id ?? null });
    if (!created.ok) return jsonResponse({ error: created.error }, 500);
    return jsonResponse({
      ok: true, actor: authorised.actor, token: created.token, session: created.session,
      kill_switch: !!settings.customer_journey_v2_kill_switch,
    });
  }

  const token = String(body.token ?? "");
  if (token.length < 16) return jsonResponse({ error: "validation" }, 400);

  if (body.action === "completion") {
    const result = await getTestCompletion(supabase, token);
    if (!result) return jsonResponse({ error: "test_session_not_found" }, 404);
    if (!result.completion) return jsonResponse({ error: "not_completed" }, 409);
    return jsonResponse({ ok: true, completion: result.completion });
  }

  const session = await loadTestSessionByToken(supabase, token);
  if (!session) return jsonResponse({ error: "test_session_not_found" }, 404);

  switch (body.action) {
    case "get":
      return jsonResponse({ ok: true, session });
    case "save_step": {
      const r = await saveTestStep(supabase, settings, session, String(body.step), body.payload ?? {});
      return r.ok
        ? jsonResponse({ ok: true, session: r.session })
        : jsonResponse({ error: r.error, details: r.details }, r.status);
    }
    case "prepare_contract": {
      const r = await prepareTestContract(supabase, settings, session);
      return r.ok
        ? jsonResponse({ ok: true, snapshot_sha256: r.snapshot_sha256, session: r.session })
        : jsonResponse({ error: r.error }, r.status);
    }
    case "accept": {
      const r = await acceptTestContract(supabase, session, {
        accepted_name: String(body.accepted_name ?? "TEST Journey Two"),
        acknowledgements: body.acknowledgements ?? {},
        evidence: body.evidence ?? {},
      });
      return r.ok ? jsonResponse({ ok: true, snapshot_sha256: r.snapshot_sha256 }) : jsonResponse({ error: r.error }, r.status);
    }
    case "submit": {
      const r = await submitTestOrder(supabase, session);
      return r.ok
        ? jsonResponse({
            ok: true, created: r.created, test_order_id: r.test_order_id,
            test_order_number: r.test_order_number, snapshot_sha256: r.snapshot_sha256,
            dd_transitions: r.dd_transitions,
          })
        : jsonResponse({ error: r.error }, r.status);
    }
    default:
      return jsonResponse({ error: "unknown_action" }, 400);
  }
});