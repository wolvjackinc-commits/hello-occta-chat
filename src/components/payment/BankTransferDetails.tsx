import { useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import {
  OCCTA_BANK_DETAILS,
  bankTransferReference,
} from "../../../supabase/functions/_shared/paymentOptions.ts";

interface BankTransferDetailsProps {
  /** Customer's OCCTA account number (preferred reference). */
  accountNumber?: string | null;
  /** Used as the reference when the account number is unknown. */
  invoiceNumber?: string | null;
  /** Amount to show, in pounds. Omit to leave the row out. */
  amount?: number | null;
  title?: string;
  className?: string;
}

/**
 * OCCTA's bank details for paying an invoice by bank transfer.
 * OCCTA takes Direct Debit or bank transfer only — no card or phone payments.
 */
export function BankTransferDetails({
  accountNumber,
  invoiceNumber,
  amount,
  title = "Pay by bank transfer",
  className = "",
}: BankTransferDetailsProps) {
  const reference = bankTransferReference(accountNumber, invoiceNumber);
  const rows: Array<[string, string]> = [
    ["Account name", OCCTA_BANK_DETAILS.accountName],
    ["Bank", OCCTA_BANK_DETAILS.bankName],
    ["Sort code", OCCTA_BANK_DETAILS.sortCode],
    ["Account number", OCCTA_BANK_DETAILS.accountNumber],
    ["Reference", reference],
  ];
  if (amount != null && Number.isFinite(Number(amount))) rows.push(["Amount", `£${Number(amount).toFixed(2)}`]);

  return (
    <div className={`border-4 border-foreground bg-background p-4 ${className}`} data-testid="bank-transfer-details">
      <p className="font-display uppercase text-sm mb-3 flex items-center gap-2">
        <Landmark className="w-4 h-4" aria-hidden="true" /> {title}
      </p>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold flex items-center gap-1 text-right">
              {v}
              {k !== "Bank" && k !== "Account name" && <CopyButton value={k === "Sort code" ? v.replace(/-/g, "") : v.replace(/^£/, "")} label={k} />}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground mt-3">
        Please quote the reference so we can match your payment. OCCTA takes payment by Direct Debit or bank
        transfer only — we do not take card payments or payments over the phone.
      </p>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="p-1 text-muted-foreground hover:text-foreground"
      aria-label={`Copy ${label}`}
      onClick={() => {
        try {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default BankTransferDetails;
