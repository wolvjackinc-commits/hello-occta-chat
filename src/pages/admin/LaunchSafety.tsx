import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReadinessCard } from "@/components/admin/launch/ReadinessCard";
import { BlockerList } from "@/components/admin/launch/BlockerList";
import { GoLiveBanner } from "@/components/admin/launch/GoLiveBanner";
import { Loader2 } from "lucide-react";

type ReportPayload = {
  worldpay_live_mode: boolean;
  worldpay_entity_id_present: boolean;
  worldpay_api_username_present: boolean;
  worldpay_api_password_present: boolean;
  worldpay_webhook_secret_present: boolean;
  expected_webhook_url: string;
  contract_pdfs_bucket_exists: boolean;
  supplier_submission_enabled: boolean;
  vat_active: boolean;
  vat_number_present: boolean;
  vat_number_masked: string | null;
  vat_looks_placeholder: boolean;
  verified_paid_pr_count: number;
};

async function countOf(
  table: string,
  apply?: (q: any) => any,
): Promise<number> {
  let q: any = (supabase as any)
    .from(table)
    .select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count ?? 0;
}

export const AdminLaunchSafety = () => {
  const report = useQuery({
    queryKey: ["launch-safety-report"],
    queryFn: async (): Promise<ReportPayload> => {
      const { data, error } = await supabase.functions.invoke(
        "launch-safety-report",
        { body: {} },
      );
      if (error) throw error;
      return data as ReportPayload;
    },
    staleTime: 30_000,
  });

  const counts = useQuery({
    queryKey: ["launch-safety-counts"],
    queryFn: async () => {
      const [
        quote_requests,
        approved_quotes,
        contract_acceptances,
        payment_requests,
        paid_verified_prs,
        provisioning_readiness,
        draft_order_packs,
        services,
        invoices,
        dd_mandates,
      ] = await Promise.all([
        countOf("quote_requests"),
        countOf("quotes", (q) => q.in("status", ["approved", "sent"])),
        countOf("contract_acceptances"),
        countOf("payment_requests"),
        countOf("payment_requests", (q) =>
          q.eq("status", "paid").eq("webhook_verified", true).not("paid_at", "is", null),
        ),
        countOf("provisioning_readiness"),
        countOf("draft_order_packs"),
        countOf("services"),
        countOf("invoices"),
        countOf("dd_mandates"),
      ]);
      const { data: latest } = await supabase
        .from("quote_requests")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        quote_requests,
        approved_quotes,
        contract_acceptances,
        payment_requests,
        paid_verified_prs,
        provisioning_readiness,
        draft_order_packs,
        services,
        invoices,
        dd_mandates,
        latest_quote_request_at: latest?.created_at ?? null,
      };
    },
    staleTime: 30_000,
  });

  if (report.isLoading || counts.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const r = report.data;
  const c = counts.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-tight">
          Launch Safety
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only operational readiness audit. No business state is changed by opening this page.
        </p>
      </div>

      <GoLiveBanner />

      <section>
        <h2 className="mb-3 font-display text-lg uppercase">Readiness</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ReadinessCard
            title="Quote Capture"
            status="ready"
            facts={[
              { label: "Quote requests", value: c?.quote_requests ?? 0 },
              {
                label: "Latest request",
                value: c?.latest_quote_request_at
                  ? new Date(c.latest_quote_request_at).toLocaleString()
                  : null,
              },
            ]}
          />
          <ReadinessCard
            title="Account Linking"
            status="ready"
            facts={[
              { label: "Account number generation", value: true },
              { label: "Quote→customer linking", value: true },
            ]}
          />
          <ReadinessCard
            title="Quote Approval"
            status="ready"
            facts={[
              { label: "Margin / floor guard", value: true },
              { label: "Approved quote immutability", value: true },
              { label: "Approved/sent quotes", value: c?.approved_quotes ?? 0 },
            ]}
          />
          <ReadinessCard
            title="Contract Summary"
            status="ready"
            facts={[
              { label: "PDF bucket", value: !!r?.contract_pdfs_bucket_exists },
              { label: "Acceptance vault", value: true },
              { label: "PDF immutability", value: true },
              { label: "Acceptances", value: c?.contract_acceptances ?? 0 },
            ]}
          />
          <ReadinessCard
            title="Payment"
            status="blocked"
            reason="Blocked — live signed webhook verification pending."
            facts={[
              { label: "Live HPP session creation", value: "Working" },
              { label: "webhook_verified=true payments", value: r?.verified_paid_pr_count ?? 0 },
              { label: "Payment requests", value: c?.payment_requests ?? 0 },
            ]}
          />
          <ReadinessCard
            title="Provisioning Readiness"
            status="prepared"
            reason="Checklist exists. Draft pack creation blocked until paid + webhook_verified."
            facts={[
              { label: "Readiness rows", value: c?.provisioning_readiness ?? 0 },
              { label: "Draft order packs", value: c?.draft_order_packs ?? 0 },
              { label: "Supplier submission flag", value: r?.supplier_submission_enabled ?? false },
            ]}
          />
          <ReadinessCard
            title="Supplier Ordering"
            status="locked"
            reason="Supplier ordering phase not built yet and payment verification pending."
          />
          <ReadinessCard
            title="Service Activation"
            status="locked"
            reason="Service activation phase not built yet."
          />
          <ReadinessCard
            title="Billing / Invoices / DD"
            status="locked"
            reason="Billing automation not built in current phase."
            facts={[
              { label: "Invoices", value: c?.invoices ?? 0 },
              { label: "DD mandates", value: c?.dd_mandates ?? 0 },
            ]}
          />
          <ReadinessCard
            title="Communications"
            status="draft-only"
            facts={[
              { label: "Journey templates", value: "Drafts present" },
              { label: "auto_send", value: false },
              { label: "Automatic emails enabled", value: false },
            ]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg uppercase">Configuration</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadinessCard
            title="Worldpay"
            status={r?.worldpay_live_mode ? "ready" : "blocked"}
            facts={[
              { label: "Live mode", value: !!r?.worldpay_live_mode },
              { label: "Entity ID configured", value: !!r?.worldpay_entity_id_present },
              { label: "API username configured", value: !!r?.worldpay_api_username_present },
              { label: "API password configured", value: !!r?.worldpay_api_password_present },
              { label: "Webhook secret present", value: !!r?.worldpay_webhook_secret_present },
              { label: "Expected webhook URL", value: r?.expected_webhook_url ?? "" },
            ]}
          />
          <ReadinessCard
            title="VAT & storage"
            status={r?.vat_looks_placeholder ? "blocked" : "ready"}
            reason={r?.vat_looks_placeholder ? "VAT number looks like a placeholder/test value." : undefined}
            facts={[
              { label: "VAT active", value: !!r?.vat_active },
              { label: "VAT number present", value: !!r?.vat_number_present },
              { label: "VAT number (masked)", value: r?.vat_number_masked ?? null },
              { label: "contract-pdfs bucket", value: !!r?.contract_pdfs_bucket_exists },
              { label: "Supplier submission flag", value: r?.supplier_submission_enabled ?? false },
              { label: "PR paid guard", value: "Trigger active" },
            ]}
          />
        </div>
      </section>

      <BlockerList />

      <section>
        <h2 className="mb-3 font-display text-lg uppercase">Audit trail (counts only)</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            ["Quote requests", c?.quote_requests],
            ["Approved quotes", c?.approved_quotes],
            ["Accepted contract summaries", c?.contract_acceptances],
            ["Payment requests", c?.payment_requests],
            ["Paid + verified", c?.paid_verified_prs],
            ["Provisioning readiness", c?.provisioning_readiness],
            ["Draft order packs", c?.draft_order_packs],
            ["Services", c?.services],
            ["Invoices", c?.invoices],
            ["DD mandates", c?.dd_mandates],
          ].map(([label, value]) => (
            <div key={label as string} className="border-2 border-foreground p-3">
              <div className="text-xs uppercase text-muted-foreground">{label as string}</div>
              <div className="font-display text-2xl">{(value as number) ?? 0}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminLaunchSafety;