import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, Shield } from "lucide-react";

export const AdminCompliance = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Compliance</h1>
        <p className="text-muted-foreground">Audit trail and communication logs.</p>
      </div>

      <Card className="border-2 border-foreground p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center gap-3">
            <Construction className="h-12 w-12 text-warning" />
            <Shield className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-display text-xl mb-2">Compliance Module Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
              The compliance tracking system including audit logs and communication logs 
              will be available once the required database tables are set up.
            </p>
          </div>
          <Badge variant="outline" className="border-2 border-foreground">
            Requires: audit_log, communications_log tables
          </Badge>
        </div>
      </Card>
    </div>
  );
};
