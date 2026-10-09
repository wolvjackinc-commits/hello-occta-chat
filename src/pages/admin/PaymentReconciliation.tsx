import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { matchAccountToProfile, type ProfileRef } from "@/lib/paymentRecon/engine";
import { fetchLiveInvoiceBalances, fetchReconState, importReconFile, linkReconSubject, markReconDraftDue } from "@/lib/paymentRecon/db";
import { PaymentReconScreen } from "@/components/admin/paymentRecon/PaymentReconScreen";
import type { FileKind } from "@/lib/paymentRecon/engine";

export function AdminPaymentReconPage({ initialTab }: { initialTab?: string }) {
  const { toast } = useToast();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["payment-recon"],
    queryFn: async () => {
      const state = await fetchReconState();
      const { data, error } = await supabase.from("profiles").select("id, account_number, full_name");
      if (error) throw error;
      const profiles = (data ?? []) as ProfileRef[];
      const ids = [...new Set(state.accounts.map((account) => matchAccountToProfile(account, profiles).profileId).filter((id): id is string => Boolean(id)))];
      const liveBalances = await fetchLiveInvoiceBalances(ids);
      return { state, profiles, liveBalances };
    },
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["payment-recon"] });
  const run = async (work: () => Promise<void>, title: string) => {
    setBusy(true);
    try {
      await work();
      toast({ title });
      await refresh();
    } catch (error) {
      toast({ title: "Reconciliation update failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading reconciliation…</p>;
  if (query.isError || !query.data) {
    return <p className="text-sm text-destructive">Reconciliation storage is not available yet. Apply the payment reconciliation migration, then reload.</p>;
  }

  return (
    <PaymentReconScreen
      state={query.data.state}
      profiles={query.data.profiles}
      liveBalances={query.data.liveBalances}
      initialTab={initialTab}
      busy={busy}
      onImport={(fileKind: FileKind, fileName, csvText) => run(async () => {
        const result = await importReconFile(fileKind, fileName, csvText);
        if (result.errors.length) throw new Error(result.errors.join(" "));
        // UI imports and Grok bot imports must follow identical settlement rules.
        // The server only posts a payment if the provider/bank settlement,
        // invoice reference, account and exact balance all match.
        const { error: syncError } = await supabase.functions.invoke("sync-verified-payments", {
          body: { dry_run: false },
        });
        if (syncError) throw new Error(
          "Import saved, but verified payment posting needs a retry. No unverified payment was marked paid."
        );
      }, "Import saved")}
      onLink={(subjectType, subjectKey, accountNumber, invoiceNumber) => run(
        () => linkReconSubject({ subjectType, subjectKey, accountNumber, invoiceNumber }),
        "Link saved",
      )}
      onMarkDraft={(rowKey) => run(() => markReconDraftDue(rowKey), "Draft marked due. No email was sent.")}
    />
  );
}

export function AdminPaymentReconciliation() {
  return <AdminPaymentReconPage initialTab="customers" />;
}

export function AdminPaymentDetails() {
  return <AdminPaymentReconPage initialTab="payments" />;
}

export default AdminPaymentReconciliation;
