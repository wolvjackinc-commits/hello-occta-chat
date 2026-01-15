import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeDollarSign, Construction } from "lucide-react";

export const AdminBilling = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Billing</h1>
        <p className="text-muted-foreground">Manage invoices, receipts, adjustments, and credit notes.</p>
      </div>

      <Card className="border-2 border-foreground p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center gap-3">
            <Construction className="h-12 w-12 text-warning" />
            <BadgeDollarSign className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-display text-xl mb-2">Billing Module Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
              The billing system including invoices, receipts, adjustments, and credit notes 
              will be available once the required database tables are set up.
            </p>
          </div>
          <Badge variant="outline" className="border-2 border-foreground">
            Requires: invoices, receipts, invoice_lines, credit_notes tables
          </Badge>
        </div>
      </Card>
    </div>
  );
};