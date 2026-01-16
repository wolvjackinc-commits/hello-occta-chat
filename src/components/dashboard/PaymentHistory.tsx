import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  CreditCard, 
  Receipt, 
  CheckCircle, 
  Clock, 
  Download,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateReceiptPdf } from '@/lib/generateReceiptPdf';

type Receipt = {
  id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  reference: string | null;
  invoice_id: string;
  invoice?: {
    invoice_number: string;
    total: number;
    issue_date: string;
  };
};

type PaymentAttempt = {
  id: string;
  amount: number;
  status: string;
  attempted_at: string;
  provider: string | null;
  provider_ref: string | null;
  reason: string | null;
  invoice_id: string | null;
};

interface PaymentHistoryProps {
  userId: string;
  limit?: number;
  showTitle?: boolean;
}

export function PaymentHistory({ userId, limit, showTitle = true }: PaymentHistoryProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentHistory();
  }, [userId]);

  const fetchPaymentHistory = async () => {
    setLoading(true);
    try {
      // Fetch receipts with invoice details
      const { data: receiptData, error: receiptError } = await supabase
        .from('receipts')
        .select(`
          *,
          invoice:invoices(invoice_number, total, issue_date)
        `)
        .eq('user_id', userId)
        .order('paid_at', { ascending: false })
        .limit(limit || 50);

      if (receiptError) throw receiptError;

      // Fetch recent payment attempts (for failed/pending)
      const { data: attemptData, error: attemptError } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'success')
        .order('attempted_at', { ascending: false })
        .limit(10);

      if (attemptError) throw attemptError;

      setReceipts(receiptData || []);
      setAttempts(attemptData || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (receipt: Receipt) => {
    setGeneratingPdf(receipt.id);
    try {
      // Fetch profile for customer info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, account_number, address_line1, city, postcode')
        .eq('id', userId)
        .single();

      generateReceiptPdf({
        receiptId: receipt.id,
        invoiceNumber: receipt.invoice?.invoice_number || 'N/A',
        customerName: profile?.full_name || 'Customer',
        customerEmail: profile?.email || '',
        accountNumber: profile?.account_number || '',
        amount: receipt.amount,
        paidAt: receipt.paid_at,
        method: receipt.method || 'Card',
        reference: receipt.reference || receipt.id.slice(0, 8).toUpperCase(),
      });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-primary border-2 border-foreground">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-warning border-2 border-foreground">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-destructive border-2 border-foreground">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-muted border-2 border-foreground">Cancelled</Badge>;
      default:
        return <Badge className="border-2 border-foreground">{status}</Badge>;
    }
  };

  const displayedReceipts = expanded ? receipts : receipts.slice(0, 3);
  const hasMore = receipts.length > 3;

  if (loading) {
    return (
      <div className="card-brutal bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-brutal bg-card p-6">
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            PAYMENT HISTORY
          </h3>
          <Badge variant="outline" className="border-2 border-foreground">
            {receipts.length} payments
          </Badge>
        </div>
      )}

      {/* Failed/Pending Attempts */}
      {attempts.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-muted-foreground font-display uppercase">Recent Activity</p>
          {attempts.slice(0, 3).map((attempt) => (
            <motion.div
              key={attempt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 border-2 border-dashed border-foreground/30 bg-background"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 flex items-center justify-center ${
                  attempt.status === 'pending' ? 'bg-warning' : 'bg-destructive'
                }`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">£{attempt.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(attempt.attempted_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(attempt.status)}
                {attempt.reason && (
                  <p className="text-xs text-muted-foreground mt-1">{attempt.reason}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Successful Payments */}
      {receipts.length > 0 ? (
        <div className="space-y-3">
          {displayedReceipts.map((receipt, index) => (
            <motion.div
              key={receipt.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-4 border-4 border-foreground bg-background hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-display text-base">£{receipt.amount.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {receipt.invoice?.invoice_number || 'Payment'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {format(new Date(receipt.paid_at), 'dd MMM yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {receipt.method || 'Card'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-2 border-foreground"
                  onClick={() => handleDownloadReceipt(receipt)}
                  disabled={generatingPdf === receipt.id}
                >
                  {generatingPdf === receipt.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </motion.div>
          ))}

          {hasMore && (
            <Button
              variant="ghost"
              className="w-full border-2 border-dashed border-foreground/30"
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
                  Show All ({receipts.length})
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-8 border-4 border-dashed border-foreground/30">
          <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-display text-lg">NO PAYMENTS YET</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your payment history will appear here
          </p>
        </div>
      )}
    </div>
  );
}
