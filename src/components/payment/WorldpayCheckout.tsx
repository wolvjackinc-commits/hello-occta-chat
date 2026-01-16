import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react';
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

declare global {
  interface Window {
    Worldpay: {
      checkout: {
        init: (config: any, callbacks: any) => Promise<any>;
      };
    };
  }
}

export function WorldpayCheckout({
  invoiceId,
  invoiceNumber,
  amount,
  currency = 'GBP',
  customerEmail,
  customerName,
  userId,
  onSuccess,
  onCancel,
}: WorldpayCheckoutProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [checkoutInstance, setCheckoutInstance] = useState<any>(null);
  const [sessionData, setSessionData] = useState<{ sessionHref: string; checkoutId: string } | null>(null);

  // Load Worldpay SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://try.access.worldpay.com/access-checkout/v2/checkout.js';
    script.async = true;
    script.onload = () => {
      initializeCheckout();
    };
    script.onerror = () => {
      setError('Failed to load payment system');
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const initializeCheckout = async () => {
    try {
      // Create session via edge function
      const { data, error: fnError } = await supabase.functions.invoke('worldpay-payment', {
        body: { action: 'create-session', currency },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || 'Failed to initialize payment session');
      }

      setSessionData({
        sessionHref: data.sessionHref,
        checkoutId: data.checkoutId,
      });

      // Initialize Access Checkout SDK
      if (window.Worldpay && data.checkoutId) {
        const checkout = await window.Worldpay.checkout.init(
          {
            id: data.checkoutId,
            form: '#card-form',
            fields: {
              pan: {
                selector: '#card-pan',
                placeholder: '4444 3333 2222 1111',
              },
              expiry: {
                selector: '#card-expiry',
                placeholder: 'MM/YY',
              },
              cvv: {
                selector: '#card-cvv',
                placeholder: '123',
              },
            },
            styles: {
              'input': {
                'font-size': '16px',
                'font-family': 'inherit',
              },
              'input.is-valid': {
                'color': '#22c55e',
              },
              'input.is-invalid': {
                'color': '#ef4444',
              },
            },
            enablePanFormatting: true,
          },
          {
            onReady: () => {
              setLoading(false);
            },
            onSuccess: (cvcHref: string) => {
              processPayment(cvcHref);
            },
            onError: (error: any) => {
              console.error('Checkout error:', error);
              setError('Card validation failed. Please check your details.');
              setProcessing(false);
            },
          }
        );

        setCheckoutInstance(checkout);
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(err.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  const processPayment = async (cvcHref: string) => {
    setProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('worldpay-payment', {
        body: {
          action: 'process-payment',
          cvcHref,
          invoiceId,
          invoiceNumber,
          amount,
          currency,
          customerEmail,
          customerName,
          userId,
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || 'Payment failed');
      }

      setPaymentSuccess(true);
      toast.success('Payment successful!');
      
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutInstance) {
      setProcessing(true);
      setError(null);
      checkoutInstance.generateSessionState();
    }
  };

  if (paymentSuccess) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
          <p className="text-muted-foreground">
            Thank you for your payment of £{amount.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            A confirmation email has been sent to {customerEmail}
          </p>
        </CardContent>
      </Card>
    );
  }

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
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading secure payment form...</p>
          </div>
        ) : (
          <form id="card-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-pan">Card Number</Label>
              <div 
                id="card-pan" 
                className="h-10 px-3 py-2 border rounded-md bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="card-expiry">Expiry Date</Label>
                <div 
                  id="card-expiry" 
                  className="h-10 px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-cvv">CVV</Label>
                <div 
                  id="card-cvv" 
                  className="h-10 px-3 py-2 border rounded-md bg-background"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Pay £{amount.toFixed(2)}
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" />
              Secured by Worldpay
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
