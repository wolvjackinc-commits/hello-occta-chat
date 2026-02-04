import React, { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";

export interface LookupResult {
  orderNumber: string;
  fullName: string;
  email: string;
  addressLine1: string;
  city: string;
  postcode: string;
  planName: string;
  planPrice: number;
  serviceType: string;
  status: string;
  createdAt: string;
}

const lookupSchema = z.object({
  orderNumber: z.string().trim().min(6, "Enter your order number"),
  email: z.string().trim().email("Enter a valid email"),
});

export function GuestOrderLookup(props: {
  onLoaded: (result: LookupResult) => void;
}) {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return lookupSchema.safeParse({ orderNumber, email }).success;
  }, [orderNumber, email]);

  const onSubmit = async () => {
    const parsed = lookupSchema.safeParse({ orderNumber, email });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message || "Please check your details.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: lookupError } = await supabase.rpc("lookup_guest_order", {
        _email: parsed.data.email,
        _order_number: parsed.data.orderNumber,
      });

      if (lookupError) throw lookupError;

      const row = data?.[0];
      if (!row) {
        setError("We couldn't find that order. Please double-check the order number and email.");
        return;
      }

      props.onLoaded({
        orderNumber: row.order_number,
        fullName: row.full_name,
        email: row.email,
        addressLine1: row.address_line1,
        city: row.city,
        postcode: row.postcode,
        planName: row.plan_name,
        planPrice: row.plan_price,
        serviceType: row.service_type,
        status: row.status,
        createdAt: row.created_at,
      });
    } catch (e) {
      logError("ThankYou.GuestOrderLookup", e);
      setError("We couldn't load your order right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card-brutal bg-card p-6">
      <h2 className="font-display text-lg uppercase tracking-wider mb-2">Find your order</h2>
      <p className="text-muted-foreground text-sm mb-6">
        If your browser cleared the checkout details, enter your order number and email to view your summary.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="font-display uppercase tracking-wider text-sm">Order number</Label>
          <Input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. ORD-ABC123..."
            className="mt-1 border-4 border-foreground"
            autoComplete="off"
          />
        </div>
        <div>
          <Label className="font-display uppercase tracking-wider text-sm">Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 border-4 border-foreground"
            autoComplete="email"
          />
        </div>
      </div>

      {error && <p className="text-destructive text-sm mt-3">{error}</p>}

      <div className="mt-5">
        <Button variant="hero" className="w-full" onClick={onSubmit} disabled={!canSubmit || isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              View my order
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
