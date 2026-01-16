import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Receipt, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { generateReceiptPdf, type ReceiptData } from "@/lib/generateReceiptPdf";
import { useToast } from "@/hooks/use-toast";

interface PaymentAttempt {
  id: string;
  amount: number;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  invoice_id: string | null;
  invoices?: {
    invoice_number: string;
    currency: string;
  } | null;
}

interface PaymentHistoryProps {
  userId: string;
  accountNumber?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
}

const statusConfig = {
  success: { icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-500/10", label: "Paid" },
  pending: { icon: Clock, color: "text-yellow-500", bgColor: "bg-yellow-500/10", label: "Pending" },
  failed: { icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/10", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", bgColor: "bg-muted", label: "Cancelled" },
};

export function PaymentHistory({ userId, accountNumber, customerName, customerEmail }: PaymentHistoryProps) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, [userId]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_attempts')
        .select(`
          id,
          amount,
          status,
          provider,
          provider_ref,
          created_at,
          invoice_id,
          invoices (
            invoice_number,
            currency
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = (payment: PaymentAttempt) => {
    if (payment.status !== 'success') {
      toast({
        title: "Cannot download receipt",
        description: "Receipts are only available for successful payments.",
        variant: "destructive",
      });
      return;
    }

    const receiptData: ReceiptData = {
      receiptNumber: `RCP-${payment.id.slice(0, 8).toUpperCase()}`,
      invoiceNumber: payment.invoices?.invoice_number || 'N/A',
      customerName: customerName || 'Customer',
      customerEmail: customerEmail || '',
      accountNumber: accountNumber || 'N/A',
      amount: payment.amount,
      currency: payment.invoices?.currency || 'GBP',
      paidAt: payment.created_at,
      paymentMethod: payment.provider === 'worldpay_hpp' ? 'Card (Worldpay)' : payment.provider || 'Card',
      transactionRef: payment.provider_ref || undefined,
    };

    generateReceiptPdf(receiptData);
  };

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const successfulPayments = payments.filter(p => p.status === 'success');
  const displayPayments = expanded ? payments : payments.slice(0, 3);

  if (loading) {
    return (
      <div className="card-brutal bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="card-brutal bg-card p-6">
        <h3 className="font-display text-lg mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          PAYMENT HISTORY
        </h3>
        <div className="text-center py-8">
          <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No payment history yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-brutal bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          PAYMENT HISTORY
        </h3>
        <div className="text-sm text-muted-foreground">
          {successfulPayments.length} successful payment{successfulPayments.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {displayPayments.map((payment, index) => {
            const status = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.pending;
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 border-2 border-foreground bg-background ${status.bgColor}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 flex items-center justify-center border-2 border-foreground bg-background ${status.color}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm">
                          {payment.invoices?.invoice_number || 'Payment'}
                        </span>
                        <span className={`text-xs uppercase font-display ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), "dd MMM yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg whitespace-nowrap">
                      {formatCurrency(payment.amount, payment.invoices?.currency)}
                    </span>
                    
                    {payment.status === 'success' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReceipt(payment)}
                        className="border-2 border-foreground"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {payments.length > 3 && (
        <>
          <Separator className="my-4" />
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Show All ({payments.length - 3} more)
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
