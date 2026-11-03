import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Which DD bureau will collect a Care payment. Chosen before the customer signs: their instruction names it.
export function DDProviderSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label="Direct Debit collected through"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="accesspay">AccessPay (APS Re OCCTA)</SelectItem>
        <SelectItem value="fastpay">FastPay</SelectItem>
      </SelectContent>
    </Select>
  );
}
