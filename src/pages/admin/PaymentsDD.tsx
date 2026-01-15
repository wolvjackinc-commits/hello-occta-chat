import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, CreditCard } from "lucide-react";

export const AdminPaymentsDD = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Payments & Direct Debit</h1>
        <p className="text-muted-foreground">Track mandates and payment attempt decline rates.</p>
      </div>

      <Card className="border-2 border-foreground p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center gap-3">
            <Construction className="h-12 w-12 text-warning" />
            <CreditCard className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-display text-xl mb-2">Payments Module Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
              The payments and direct debit management system will be available once 
              the required database tables are set up.
            </p>
          </div>
          <Badge variant="outline" className="border-2 border-foreground">
            Requires: dd_mandates, payment_attempts tables
          </Badge>
        </div>
      </Card>
    </div>
  );
};
