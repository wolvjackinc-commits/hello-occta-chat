import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { broadbandRetailCards, landlineRetailCard } from "@/lib/pricing/retailCards";
import { Zap, Star, Phone, ArrowRight } from "lucide-react";

export const AdminPlans = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display">Broadband Plans</h1>
          <p className="text-sm text-muted-foreground">
            Public retail bands OCCTA sells to customers. Prices are derived from the ICUK
            wholesale catalogue and margin rules — edit those to change what customers see.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="border-2 border-foreground">
            <Link to="/admin/pricing-rules">Pricing rules</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-2 border-foreground">
            <Link to="/admin/margin-rules">Margin rules</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-2 border-foreground">
            <Link to="/admin/suppliers">Supplier catalogue</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {broadbandRetailCards.map((card) => (
          <Card key={card.id} className="border-2 border-foreground p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="font-display text-sm uppercase">{card.publicTitle}</div>
              {card.popular && (
                <Badge className="border-2 border-foreground bg-primary/10 text-foreground gap-1">
                  <Star className="w-3 h-3" /> Popular
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" /> {card.speedLabel || "—"}
            </div>
            <p className="text-xs text-muted-foreground">{card.publicTagline}</p>
            <ul className="mt-1 space-y-1 text-xs">
              {card.publicFeatures.slice(0, 4).map((f) => (
                <li key={f} className="flex gap-1"><span className="text-muted-foreground">•</span>{f}</li>
              ))}
            </ul>
            <div className="mt-auto pt-2 text-xs text-muted-foreground">
              Mapped products: <span className="font-mono">{card.eligibleProductIds.length}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-foreground p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5" />
            <div>
              <div className="font-display text-sm uppercase">{landlineRetailCard.publicTitle}</div>
              <p className="text-xs text-muted-foreground">{landlineRetailCard.publicTagline}</p>
            </div>
          </div>
          <Badge variant="outline" className="border-2 border-foreground text-xs">
            Products: {landlineRetailCard.eligibleProductIds.length}
          </Badge>
        </div>
      </Card>

      <Card className="border-2 border-foreground p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display text-sm uppercase">SIM Plans</div>
            <p className="text-xs text-muted-foreground">
              SIM catalogue is managed separately.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="border-2 border-foreground">
            <Link to="/admin/sim-plans">Open SIM Plans <ArrowRight className="w-3 h-3 ml-1" /></Link>
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        VAT display: residential plans shown incl. VAT. Business shown ex. VAT. Adjust rate at{" "}
        <Link to="/admin/vat-settings" className="underline">VAT settings</Link>.
      </p>
    </div>
  );
};
