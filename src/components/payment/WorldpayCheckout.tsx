import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        init: (
          config: any,
          callback: (error: any, checkout: any) => void
        ) => void;
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
  const [sdkReady, setSdkReady] = useState(false);
  const initAttempted = useRef(false);

  const processPayment = useCallback(
    async (cardSessionHref: string, cvvSessionHref: string) => {
      setProcessing(true);
      setError(null);

      try {
        console.log('Processing payment with sessions:', { cardSessionHref, cvvSessionHref });

        const { data, error: fnError } = await supabase.functions.invoke('worldpay-payment', {
          body: {
            action: 'process-payment',
            cardSessionHref,
            cvvSessionHref,
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
    },
    [invoiceId, invoiceNumber, amount, currency, customerEmail, customerName, userId, onSuccess]
  );

  // Load Worldpay SDK
  useEffect(() => {
    // Check if already loaded
    if (window.Worldpay) {
      setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://try.access.worldpay.com/access-checkout/v2/checkout.js';
    script.async = true;
    script.onload = () => {
      console.log('Worldpay SDK loaded');
      setSdkReady(true);
    };
    script.onerror = () => {
      setError('Failed to load payment system');
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Initialize checkout when SDK is ready
  useEffect(() => {
    if (!sdkReady || initAttempted.current) return;
    initAttempted.current = true;
    initializeCheckout();
  }, [sdkReady]);

  const initializeCheckout = async (retryCount = 0) => {
    const maxRetries = 3;
    
    try {
      console.log(`Initializing Worldpay checkout (attempt ${retryCount + 1})...`);
      
      // Get checkout configuration from edge function
      const { data, error: fnError } = await supabase.functions.invoke('worldpay-payment', {
        body: { action: 'get-checkout-config' },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || 'Failed to get checkout configuration');
      }

      console.log('Got checkout config:', { checkoutId: data.checkoutId });

      // Wait for DOM elements to be ready with exponential backoff
      const delay = 500 * (retryCount + 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Check if DOM elements exist
      const panEl = document.getElementById('worldpay-card-pan');
      const expiryEl = document.getElementById('worldpay-card-expiry');
      const cvvEl = document.getElementById('worldpay-card-cvv');
      
      if (!panEl || !expiryEl || !cvvEl) {
        if (retryCount < maxRetries) {
          console.log('DOM elements not ready, retrying...');
          return initializeCheckout(retryCount + 1);
        }
        throw new Error('Payment form elements not found');
      }

      // Initialize Access Checkout SDK with callback pattern (correct SDK format)
      if (window.Worldpay?.checkout) {
        window.Worldpay.checkout.init(
          {
            id: data.checkoutId,
            form: '#worldpay-card-form',
            fields: {
              pan: {
                selector: '#worldpay-card-pan',
                placeholder: '4444 3333 2222 1111',
              },
              expiry: {
                selector: '#worldpay-card-expiry',
                placeholder: 'MM/YY',
              },
              cvv: {
                selector: '#worldpay-card-cvv',
                placeholder: '123',
              },
            },
            styles: {
              input: {
                'font-size': '16px',
                'font-family': 'inherit',
                color: '#000',
              },
              'input.is-valid': {
                color: '#16a34a',
              },
              'input.is-invalid': {
                color: '#dc2626',
              },
            },
            enablePanFormatting: true,
          },
          // Callback function
          function (initError: any, checkout: any) {
            if (initError) {
              console.error('Checkout init error:', initError);
              console.log('Current origin:', window.location.origin);
              console.log('Error type:', typeof initError);
              console.log('Error constructor:', initError?.constructor?.name);
              
              // Try to extract the actual error message
              let errorMsg = 'Unknown initialization error';
              
              if (typeof initError === 'string') {
                errorMsg = initError;
              } else if (initError?.message) {
                errorMsg = initError.message;
              } else if (initError?.errorName) {
                errorMsg = initError.errorName;
              } else if (initError?.error) {
                errorMsg = initError.error;
              } else if (initError?.name) {
                errorMsg = initError.name;
              } else if (initError?.code) {
                errorMsg = `Error code: ${initError.code}`;
              } else {
                // Try to get all properties including non-enumerable ones
                const props = Object.getOwnPropertyNames(initError);
                console.log('Error properties:', props);
                if (props.length > 0) {
                  errorMsg = props.map(k => `${k}: ${initError[k]}`).join(', ');
                }
              }
              
              setError(`Failed to initialize: ${errorMsg} (Origin: ${window.location.origin})`);
              setLoading(false);
              return;
            }

            console.log('Checkout initialized successfully');
            setCheckoutInstance(checkout);
            setLoading(false);
          }
        );
      } else {
        throw new Error('Worldpay SDK not available');
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(err.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!checkoutInstance) {
      setError('Payment form not ready. Please refresh and try again.');
      return;
    }

    setProcessing(true);
    setError(null);
    console.log('Generating sessions...');

    checkoutInstance.generateSessions(function (genError: any, sessions: { card: string; cvv: string }) {
      if (genError) {
        console.error('Session generation error:', genError);
        setError('Card validation failed. Please check your details.');
        setProcessing(false);
        return;
      }

      processPayment(sessions.card, sessions.cvv);
    });
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
          <form id="worldpay-card-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="worldpay-card-pan">Card Number</Label>
              <div 
                id="worldpay-card-pan" 
                className="h-10 px-3 py-2 border-2 border-foreground rounded-md bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="worldpay-card-expiry">Expiry Date</Label>
                <div 
                  id="worldpay-card-expiry" 
                  className="h-10 px-3 py-2 border-2 border-foreground rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worldpay-card-cvv">CVV</Label>
                <div 
                  id="worldpay-card-cvv" 
                  className="h-10 px-3 py-2 border-2 border-foreground rounded-md bg-background"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Debug info panel */}
            <div className="p-3 bg-muted rounded-md text-xs font-mono space-y-1">
              <p><strong>Debug:</strong></p>
              <p>Origin: {window.location.origin}</p>
              <p>SDK Loaded: {sdkReady ? 'Yes' : 'No'}</p>
              <p>Checkout Ready: {checkoutInstance ? 'Yes' : 'No'}</p>
              <p>Worldpay Available: {typeof window !== 'undefined' && window.Worldpay?.checkout ? 'Yes' : 'No'}</p>
            </div>

            <div className="flex gap-3 pt-2">
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
