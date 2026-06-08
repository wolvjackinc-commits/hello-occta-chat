import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertOctagon } from "lucide-react";

export function ComplaintsTab() {
  return (
    <div className="space-y-4">
      <div className="p-6 border-4 border-foreground bg-background">
        <h3 className="font-display uppercase text-lg mb-2 flex items-center gap-2"><AlertOctagon className="w-5 h-5" /> Raising a complaint</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We aim to resolve every complaint quickly and fairly. Contact us via support, email or phone with your account number.
          If we can't resolve it within 8 weeks, you can refer to our Alternative Dispute Resolution (ADR) scheme — see our Complaints Code for details.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Link to="/legal/complaints-code"><Button variant="outline" className="border-2 border-foreground">Read Complaints Code</Button></Link>
          <Link to="/complaints"><Button variant="hero">Raise a complaint</Button></Link>
        </div>
      </div>
      <div className="p-4 border-2 border-dashed border-foreground/30 bg-background text-sm text-muted-foreground">
        Complaint tracking is coming soon. Any complaints you raise will appear here.
      </div>
    </div>
  );
}