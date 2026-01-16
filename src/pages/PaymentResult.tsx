import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  Download, 
  Receipt,
  Calendar,
  CreditCard,
  FileText,
  Sparkles
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { format } from 'date-fns';
import { generateReceiptPdf } from '@/lib/generateReceiptPdf';

type PaymentDetails = {
  invoiceNumber: string;
  amount: number;
  paidAt: string;
  method: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  accountNumber: string;
};

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
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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

        // If successful, fetch payment details for receipt
        if (data.success) {
          await fetchPaymentDetails();
          // Send confirmation email
          await sendPaymentConfirmationEmail();
        }
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

  const fetchPaymentDetails = async () => {
    try {
      // Get invoice and profile details
      const { data: invoice } = await supabase
        .from('invoices')
        .select('invoice_number, total, user_id')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, account_number')
          .eq('id', invoice.user_id)
          .single();

        // Get the latest receipt for this invoice
        const { data: receipt } = await supabase
          .from('receipts')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        setPaymentDetails({
          invoiceNumber: invoice.invoice_number,
          amount: invoice.total,
          paidAt: receipt?.paid_at || new Date().toISOString(),
          method: receipt?.method || 'Card',
          reference: receipt?.reference || invoiceId!.slice(0, 8).toUpperCase(),
          customerName: profile?.full_name || 'Customer',
          customerEmail: profile?.email || '',
          accountNumber: profile?.account_number || '',
        });
      }
    } catch (err) {
      console.error('Error fetching payment details:', err);
    }
  };

  const sendPaymentConfirmationEmail = async () => {
    try {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('invoice_number, total, user_id')
        .eq('id', invoiceId)
        .single();

      if (!invoice) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', invoice.user_id)
        .single();

      if (!profile?.email) return;

      await supabase.functions.invoke('send-email', {
        body: {
          type: 'invoice_paid',
          to: profile.email,
          data: {
            customer_name: profile.full_name,
            invoice_number: invoice.invoice_number,
            total: invoice.total,
            paid_date: format(new Date(), 'dd MMMM yyyy'),
            receipt_reference: invoiceId?.slice(0, 8).toUpperCase(),
          },
        },
      });
    } catch (err) {
      console.error('Error sending confirmation email:', err);
    }
  };

  const handleDownloadReceipt = () => {
    if (!paymentDetails) return;
    setGeneratingPdf(true);
    try {
      generateReceiptPdf({
        receiptId: invoiceId || '',
        invoiceNumber: paymentDetails.invoiceNumber,
        customerName: paymentDetails.customerName,
        customerEmail: paymentDetails.customerEmail,
        accountNumber: paymentDetails.accountNumber,
        amount: paymentDetails.amount,
        paidAt: paymentDetails.paidAt,
        method: paymentDetails.method,
        reference: paymentDetails.reference,
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  if (verifying) {
    return (
      <Layout>
        <div className="container max-w-lg mx-auto py-16 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-brutal bg-card p-8"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 bg-primary flex items-center justify-center mx-auto mb-6"
              >
                <Loader2 className="w-8 h-8 text-primary-foreground" />
              </motion.div>
              <h3 className="font-display text-display-sm mb-2">VERIFYING PAYMENT</h3>
              <p className="text-muted-foreground">
                Please wait while we confirm your transaction...
              </p>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-lg mx-auto py-12 px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="card-brutal bg-card overflow-hidden"
        >
          {/* Header Banner */}
          <motion.div
            variants={itemVariants}
            className={`p-8 text-center ${
              result?.success 
                ? 'bg-primary' 
                : result?.status === 'cancelled' 
                  ? 'bg-warning' 
                  : 'bg-destructive'
            }`}
          >
            {result?.success ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
              >
                <div className="relative inline-block">
                  <CheckCircle className="w-20 h-20 text-primary-foreground" />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles className="w-8 h-8 text-warning" />
                  </motion.div>
                </div>
                <h1 className="font-display text-display-md text-primary-foreground mt-4">
                  PAYMENT SUCCESSFUL!
                </h1>
              </motion.div>
            ) : result?.status === 'cancelled' ? (
              <>
                <AlertCircle className="w-20 h-20 mx-auto" />
                <h1 className="font-display text-display-md mt-4">PAYMENT CANCELLED</h1>
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 text-destructive-foreground mx-auto" />
                <h1 className="font-display text-display-md text-destructive-foreground mt-4">
                  PAYMENT FAILED
                </h1>
              </>
            )}
          </motion.div>

          {/* Content */}
          <div className="p-8">
            {result?.success && paymentDetails ? (
              <motion.div variants={itemVariants} className="space-y-6">
                <p className="text-center text-muted-foreground">
                  Your payment has been processed successfully. A confirmation email has been sent to your registered email address.
                </p>

                {/* Transaction Details */}
                <div className="border-4 border-foreground bg-secondary/30 p-6 space-y-4">
                  <h3 className="font-display text-lg border-b-2 border-foreground pb-2">
                    TRANSACTION DETAILS
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-foreground flex items-center justify-center">
                        <FileText className="w-5 h-5 text-background" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Invoice</p>
                        <p className="font-display">{paymentDetails.invoiceNumber}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-foreground flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-background" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Method</p>
                        <p className="font-display capitalize">{paymentDetails.method}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-foreground flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-background" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Date</p>
                        <p className="font-display">
                          {format(new Date(paymentDetails.paidAt), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-foreground flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-background" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Reference</p>
                        <p className="font-display font-mono">{paymentDetails.reference}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t-2 border-foreground pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-display text-lg">AMOUNT PAID</span>
                      <span className="font-display text-display-sm">
                        £{paymentDetails.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Download Receipt */}
                <motion.div
                  whileHover={{ y: -4, x: -4, boxShadow: "8px 8px 0px 0px hsl(var(--foreground))" }}
                >
                  <Button
                    onClick={handleDownloadReceipt}
                    disabled={generatingPdf}
                    className="w-full"
                    variant="hero"
                  >
                    {generatingPdf ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 mr-2" />
                    )}
                    Download Receipt
                  </Button>
                </motion.div>

                <Badge className="w-full justify-center py-2 bg-primary/10 text-primary border-2 border-primary">
                  ✓ Payment confirmed • Receipt available
                </Badge>
              </motion.div>
            ) : result?.status === 'cancelled' ? (
              <motion.div variants={itemVariants} className="text-center space-y-4">
                <p className="text-muted-foreground">
                  You cancelled the payment. No charges have been made to your account.
                </p>
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="text-center space-y-4">
                <p className="text-muted-foreground">
                  {result?.message || 'Your payment could not be processed. Please try again or contact support.'}
                </p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div variants={itemVariants} className="flex flex-col gap-3 mt-8">
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="border-4 border-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              
              {!result?.success && invoiceId && (
                <Button 
                  variant="hero"
                  onClick={() => navigate(`/pay-invoice?id=${invoiceId}`)}
                >
                  Try Again
                </Button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
