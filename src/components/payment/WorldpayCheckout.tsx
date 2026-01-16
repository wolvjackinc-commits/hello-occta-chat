import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Lock, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WorldpayCheckoutProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency?: string;
  customerEmail: string;
  customerName: string;
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function WorldpayCheckout({
  invoiceId,
  invoiceNumber,
  amount,
  currency = 'GBP',
  customerEmail,
  customerName,
  userId,
  onCancel,
}: WorldpayCheckoutProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Get the current page URL to use as return URL
      const returnUrl = `${window.location.origin}/payment-result`;

      console.log('Creating payment session with return URL:', returnUrl);

      const { data, error: fnError } = await supabase.functions.invoke('worldpay-payment', {
        body: {
          action: 'create-payment-session',
          invoiceId,
          invoiceNumber,
          amount,
          currency,
          customerEmail,
          customerName,
          userId,
          returnUrl,
        },
      });

      if (fnError) {
        console.error('Function error:', fnError);
        throw new Error('Failed to connect to payment service');
      }

      if (!data?.success) {
        console.error('Payment session error:', data);
        throw new Error(data?.error || 'Failed to create payment session');
      }

      console.log('Payment session created, redirecting to:', data.checkoutUrl);

      // Redirect to Worldpay Hosted Payment Page
      window.location.href = data.checkoutUrl;

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to start payment. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pay Invoice {invoiceNumber}
        </CardTitle>
        <CardDescription>
          Amount due: <span className="font-semibold text-foreground">£{amount.toFixed(2)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            You'll be redirected to Worldpay's secure payment page to complete your payment.
          </p>
        </div>

        {error && (
          <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-2 border-foreground"
            onClick={onCancel}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handlePayment}
            disabled={processing}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Redirecting...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Pay £{amount.toFixed(2)}
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" />
          Secured by Worldpay
        </p>
      </CardContent>
    </Card>
  );
}
