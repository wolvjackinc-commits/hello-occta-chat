import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowLeft,
  Receipt,
  Calendar,
  CreditCard,
  Mail,
  Download,
  Home
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentDetails {
  success: boolean;
  message: string;
  status: string;
  invoice?: {
    invoice_number: string;
    total_amount: number;
    currency: string;
    paid_at?: string;
  };
}

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const status = searchParams.get('status');
  const invoiceId = searchParams.get('invoiceId');
  
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<PaymentDetails | null>(null);

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
          invoice: data.invoice,
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

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (verifying) {
    return (
      <Layout>
        <div className="container max-w-lg mx-auto py-16 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))]">
              <CardContent className="pt-12 pb-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block"
                >
                  <Loader2 className="h-16 w-16 text-primary mx-auto" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-xl font-bold mt-6 mb-2 font-display uppercase tracking-wide">
                    Verifying Payment
                  </h3>
                  <p className="text-muted-foreground">
                    Please wait while we confirm your payment...
                  </p>
                </motion.div>
                
                {/* Progress dots */}
                <div className="flex justify-center gap-2 mt-6">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-primary rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-lg mx-auto py-16 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={result?.status}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Card className="border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] overflow-hidden">
              {/* Status Banner */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`py-4 px-6 ${
                  result?.success 
                    ? 'bg-green-500' 
                    : result?.status === 'cancelled' 
                    ? 'bg-yellow-500' 
                    : 'bg-destructive'
                }`}
              >
                <p className="text-white font-display text-sm uppercase tracking-widest">
                  {result?.success ? 'Payment Successful' : result?.status === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}
                </p>
              </motion.div>

              <CardContent className="pt-8 pb-8">
                {/* Icon Animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.3
                  }}
                  className="text-center mb-6"
                >
                  {result?.success ? (
                    <div className="relative inline-block">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="absolute inset-0 bg-green-100 rounded-full"
                        style={{ transform: 'scale(1.5)' }}
                      />
                      <CheckCircle className="h-20 w-20 text-green-500 relative z-10" />
                    </div>
                  ) : result?.status === 'cancelled' ? (
                    <AlertCircle className="h-20 w-20 text-yellow-500 mx-auto" />
                  ) : (
                    <XCircle className="h-20 w-20 text-destructive mx-auto" />
                  )}
                </motion.div>

                {/* Title and Message */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-center mb-6"
                >
                  <h3 className="text-2xl font-bold font-display uppercase tracking-wide mb-2">
                    {result?.success 
                      ? 'Thank You!' 
                      : result?.status === 'cancelled' 
                      ? 'Payment Cancelled' 
                      : 'Payment Failed'}
                  </h3>
                  <p className="text-muted-foreground">
                    {result?.success 
                      ? 'Your payment has been processed successfully.'
                      : result?.status === 'cancelled'
                      ? 'You cancelled the payment. No charges have been made.'
                      : result?.message || 'Your payment could not be processed.'}
                  </p>
                </motion.div>

                {/* Transaction Details */}
                {result?.invoice && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-muted/50 border-2 border-border p-5 mb-6"
                  >
                    <h4 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Transaction Details
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Invoice Number
                        </span>
                        <span className="font-mono font-bold">{result.invoice.invoice_number}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {result?.success ? 'Paid On' : 'Date'}
                        </span>
                        <span className="text-sm">{formatDate(result.invoice.paid_at)}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount</span>
                        <span className="text-xl font-bold text-primary">
                          {formatCurrency(result.invoice.total_amount, result.invoice.currency)}
                        </span>
                      </div>
                    </div>

                    {result?.success && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-4 pt-4 border-t border-border"
                      >
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Mail className="h-4 w-4" />
                          <span>A confirmation email has been sent to your registered email address.</span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-col gap-3"
                >
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    size="lg"
                    className="w-full font-display uppercase tracking-wider border-2 border-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Back to Dashboard
                  </Button>
                  
                  {result?.success && (
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/dashboard')}
                      size="lg"
                      className="w-full font-display uppercase tracking-wider border-2 border-foreground"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Receipt
                    </Button>
                  )}
                  
                  {!result?.success && invoiceId && (
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/pay-invoice?id=${invoiceId}`)}
                      size="lg"
                      className="w-full font-display uppercase tracking-wider border-2 border-foreground"
                    >
                      Try Again
                    </Button>
                  )}
                </motion.div>

                {/* Support Info */}
                {!result?.success && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="text-center text-sm text-muted-foreground mt-6"
                  >
                    Need help? Contact our support team at{' '}
                    <a href="mailto:support@occta.co.uk" className="text-primary underline">
                      support@occta.co.uk
                    </a>
                  </motion.p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </Layout>
  );
}
