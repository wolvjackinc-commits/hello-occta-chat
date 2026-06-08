import { Gift, Users, Award } from "lucide-react";

export function RewardsTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 border-4 border-foreground bg-primary/10">
        <p className="font-display uppercase">OCCTA Rewards is coming soon</p>
        <p className="text-sm text-muted-foreground mt-1">Final reward values, eligibility and unlock rules will be shown before activation.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { icon: Users, title: "Referral link", body: "Coming soon" },
          { icon: Award, title: "Points balance", body: "Coming soon" },
          { icon: Gift, title: "Contract Saver benefits", body: "Coming soon" },
        ].map((c) => (
          <div key={c.title} className="p-4 border-2 border-foreground bg-background">
            <c.icon className="w-6 h-6 mb-2" />
            <p className="font-display uppercase">{c.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}