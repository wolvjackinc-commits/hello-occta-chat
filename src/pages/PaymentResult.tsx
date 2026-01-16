import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Layout from '@/components/layout/Layout';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const status = searchParams.get('status');
  const invoiceId = searchParams.get('invoiceId');
  
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    verifyPayment();
  }, [status, invoiceId]);

  const verifyPayment = async () => {
    if (!invoiceId || !status) {
      setResult({
        success: false,
        message: 'Invalid payment response',
        status: 'error',
      });
      setVerifying(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('worldpay-payment', {
        body: {
          action: 'verify-payment',
          invoiceId,
          status,
        },
      });

      if (error) {
        console.error('Verification error:', error);
        setResult({
          success: false,
          message: 'Failed to verify payment status',
          status: 'error',
        });
      } else {
        setResult({
          success: data.success,
          message: data.message,
          status: data.status,
        });
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      setResult({
        success: false,
        message: 'An error occurred while verifying payment',
        status: 'error',
      });
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <Layout>
        <div className="container max-w-md mx-auto py-12 px-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Verifying Payment</h3>
              <p className="text-muted-foreground">
                Please wait while we confirm your payment...
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-md mx-auto py-12 px-4">
        <Card>
          <CardContent className="pt-6 text-center">
            {result?.success ? (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
                <p className="text-muted-foreground mb-6">
                  Your payment has been processed successfully. A confirmation email will be sent shortly.
                </p>
              </>
            ) : result?.status === 'cancelled' ? (
              <>
                <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Payment Cancelled</h3>
                <p className="text-muted-foreground mb-6">
                  You cancelled the payment. No charges have been made.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Payment Failed</h3>
                <p className="text-muted-foreground mb-6">
                  {result?.message || 'Your payment could not be processed. Please try again.'}
                </p>
              </>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              
              {!result?.success && invoiceId && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/pay-invoice?id=${invoiceId}`)}
                >
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
