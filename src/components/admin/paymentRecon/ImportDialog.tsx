import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FILE_KINDS, type FileKind } from "@/lib/paymentRecon/engine";

const LABELS: Record<FileKind, string> = {
  customer_status: "Customer status snapshot",
  payment_events: "Payment events",
  accesspay_daily: "AccessPay daily export",
  bank_statement: "Bank statement lines",
};

const HINTS: Record<FileKind, string> = {
  customer_status: "Replaces the customer snapshot. Importing the same file again does not duplicate rows.",
  payment_events: "Upserts each payment by payment reference. The same file does not create a second payment.",
  accesspay_daily: "Upserts collections, failures, mandates and payouts. Status changes are added to the timeline once.",
  bank_statement: "Matches amount, date, payer alias and payout reference. Anything left over stays unlinked.",
};

export function ImportDialog({
  open,
  onOpenChange,
  busy,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onImport: (fileKind: FileKind, fileName: string, csvText: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<FileKind>("customer_status");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<string[][]>([]);

  const choose = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).slice(0, 6);
    setPreview(lines.map((line) => line.split(",").slice(0, 6)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-2 border-foreground">
        <DialogHeader>
          <DialogTitle className="font-display">Import reconciliation file</DialogTitle>
          <DialogDescription>{HINTS[kind]}</DialogDescription>
        </DialogHeader>
        <label className="text-sm block">
          File type
          <select
            className="mt-1 w-full border-2 border-foreground bg-background p-2"
            value={kind}
            onChange={(event) => setKind(event.target.value as FileKind)}
          >
            {FILE_KINDS.map((value) => (
              <option key={value} value={value}>{LABELS[value]}</option>
            ))}
          </select>
        </label>
        <input
          aria-label="Reconciliation CSV"
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={(event) => void choose(event.target.files?.[0] ?? null)}
        />
        {preview.length > 0 && (
          <div className="overflow-auto border-2 border-foreground max-h-40 text-xs">
            <table className="w-full">
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-b border-foreground/10">
                    {row.map((value, cell) => <td key={cell} className="p-1">{value}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button
          disabled={busy || !csvText}
          onClick={() => void onImport(kind, fileName || "upload.csv", csvText)}
        >
          {kind === "customer_status" ? "Replace customer snapshot" : "Upsert rows"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
