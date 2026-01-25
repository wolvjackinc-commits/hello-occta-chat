import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Copy, 
  ExternalLink, 
  FileText, 
  Plus, 
  Ticket,
  MoreHorizontal,
  Check
} from "lucide-react";
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

  const handleCopyAccount = async () => {
    if (!accountNumber) return;
    await navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    toast({ title: "Account number copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const detailPath = `/admin/customers/${accountNumber || customerId}`;

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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default CustomerQuickActions;
