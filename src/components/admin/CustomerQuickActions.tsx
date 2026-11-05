import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Copy, 
  ExternalLink, 
  FileText, 
  Plus, 
  Ticket,
  MoreHorizontal,
  Check,
  Trash2,
  Loader2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface CustomerQuickActionsProps {
  customerId: string;
  accountNumber: string | null;
  customerName: string | null;
}

export const CustomerQuickActions = ({
  customerId,
  accountNumber,
  customerName,
}: CustomerQuickActionsProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleCopyAccount = async () => {
    if (!accountNumber) return;
    await navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    toast({ title: "Account number copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  // Never route by UUID — Customer 360 only resolves by account number.
  // If the customer has no account number, surface reconciliation.
  const detailPath = accountNumber
    ? `/admin/customers/${accountNumber}`
    : "/admin/customers";

  return (
    <div className="flex items-center gap-2">
      {/* Primary action: View details */}
      <Button asChild size="sm" className="border-2 border-foreground">
        <Link to={detailPath}>
          <ExternalLink className="h-4 w-4 mr-1" />
          View
        </Link>
      </Button>

      {/* Secondary actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="border-2 border-foreground px-2">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-2 border-foreground">
          {/* Copy account number */}
          <DropdownMenuItem
            onClick={handleCopyAccount}
            disabled={!accountNumber}
            className="cursor-pointer"
          >
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copy Account Number
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Create invoice */}
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to={`/admin/billing?action=create&user=${customerId}`}>
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </Link>
          </DropdownMenuItem>

          {/* Add service */}
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to={`/admin/services?action=add&user=${customerId}`}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Link>
          </DropdownMenuItem>

          {/* Create ticket */}
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to={`/admin/tickets?action=create&user=${customerId}&name=${encodeURIComponent(customerName || '')}`}>
              <Ticket className="h-4 w-4 mr-2" />
              Create Ticket
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Owner-only delete (passcode) */}
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteCustomerDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        customerId={customerId}
        accountNumber={accountNumber}
        customerName={customerName}
      />
    </div>
  );
};

// Owner-only delete. The passcode is checked server-side in admin_delete_customer, never here.
const DeleteCustomerDialog = ({ open, onClose, customerId, accountNumber, customerName }: CustomerQuickActionsProps & { open: boolean; onClose: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const label = customerName || accountNumber || "this customer";

  const close = () => { onClose(); setPasscode(""); };
  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("admin_delete_customer", {
        p_customer_id: customerId,
        p_passcode: passcode,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Delete failed");
      toast({ title: "Customer deleted", description: `${label}: all emails, invoices, Direct Debits and automatic jobs stopped.` });
      close();
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (e) {
      toast({ title: "Not deleted", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      setPasscode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="border-2 border-foreground">
          <DialogHeader>
            <DialogTitle>Delete {label}?</DialogTitle>
            <DialogDescription>
              Removes them from the customer list and stops every email, invoice, Direct Debit, letter and automatic job.
              Paid invoices and history are kept for records. This can't be undone from the dashboard.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (passcode) submit(); }}>
            <label htmlFor={`del-pass-${customerId}`} className="text-sm font-medium">Owner passcode</label>
            <Input
              id={`del-pass-${customerId}`}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="mt-1 border-2 border-foreground"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={!passcode || busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomerQuickActions;
