import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "ready"; email: string }
  | { kind: "done"; email: string }
  | { kind: "error"; message: string };

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

async function call(token: string, lookup: boolean): Promise<{ ok?: boolean; email?: string; unsubscribed?: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("outreach-unsubscribe", { body: { token, lookup } });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === "function") return (ctx as Response).clone().json().catch(() => ({ error: "request_failed" }));
    return { error: "request_failed" };
  }
  return data ?? {};
}

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!TOKEN_RE.test(token)) {
      setState({ kind: "error", message: "This unsubscribe link isn't complete. Please use the link from the email, or reply to the email asking us to stop." });
      return;
    }
    call(token, true).then((r) => {
      if (r.ok && r.email) setState(r.unsubscribed ? { kind: "done", email: r.email } : { kind: "ready", email: r.email });
      else setState({ kind: "error", message: "We couldn't find this link. Please reply to the email asking us to stop, or email hello@occta.co.uk." });
    });
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const r = await call(token, false);
    setBusy(false);
    if (r.ok) setState({ kind: "done", email: r.email ?? "" });
    else setState({ kind: "error", message: "Something went wrong. Please try again, or email hello@occta.co.uk and we'll remove you." });
  };

  return (
    <Layout>
      <SEO title="Unsubscribe — OCCTA" description="Stop receiving OCCTA business emails." canonical="/unsubscribe" noIndex />
      <section className="container mx-auto px-4 py-16 max-w-xl">
        <div className="border-4 border-foreground bg-background p-8 shadow-brutal space-y-4">
          <h1 className="font-display text-4xl">Unsubscribe</h1>
          {state.kind === "loading" && <p>Checking your link…</p>}
          {state.kind === "ready" && (
            <>
              <p>Stop OCCTA business emails to <strong>{state.email}</strong>?</p>
              <Button size="lg" onClick={confirm} disabled={busy}>{busy ? "Unsubscribing…" : "Unsubscribe"}</Button>
            </>
          )}
          {state.kind === "done" && (
            <p>Done. We won't send marketing emails to <strong>{state.email}</strong> again. If you're an OCCTA customer you'll still get service emails such as bills.</p>
          )}
          {state.kind === "error" && <p>{state.message}</p>}
        </div>
      </section>
    </Layout>
  );
};

export default Unsubscribe;
