import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, Wrench } from "lucide-react";

export const AdminServices = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Services</h1>
        <p className="text-muted-foreground">Track provisioned services and supplier references.</p>
      </div>

      <Card className="border-2 border-foreground p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center gap-3">
            <Construction className="h-12 w-12 text-warning" />
            <Wrench className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-display text-xl mb-2">Services Module Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
              The services management system will be available once the required 
              database tables are set up for tracking provisioned services.
            </p>
          </div>
          <Badge variant="outline" className="border-2 border-foreground">
            Requires: services table
          </Badge>
        </div>
      </Card>
    </div>
  );
};
