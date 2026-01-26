import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, AlertCircle, CheckCircle, ArrowLeft, CreditCard, Calendar, Receipt, Download } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { format } from 'date-fns';
import { generateReceiptPdf } from '@/lib/generateReceiptPdf';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  currency: string;
  status: string;
  due_date: string | null;
  issue_date: string;
  user_id: string;
}

interface Profile {
  email: string | null;
  full_name: string | null;
  account_number: string | null;
}

interface ReceiptData {
  id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  reference: string | null;
}

export default function PayInvoice() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    checkAuthAndLoadInvoice();
  }, [invoiceId]);

  const checkAuthAndLoadInvoice = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        navigate(`/auth?redirect=/pay-invoice?id=${invoiceId}`);
        return;
      }
      
      setUser(currentUser);

      if (!invoiceId) {
        setError('No invoice specified');
        setLoading(false);
        return;
      }

      // Load invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoiceData) {
        setError('Invoice not found');
        setLoading(false);
        return;
      }

      // Check user owns this invoice
      if (invoiceData.user_id !== currentUser.id) {
        setError('You do not have permission to view this invoice');
        setLoading(false);
        return;
      }

      setInvoice(invoiceData);

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, full_name, account_number')
        .eq('id', currentUser.id)
        .single();

      setProfile(profileData);

      // If invoice is paid, load receipt
      if (invoiceData.status === 'paid') {
        const { data: receiptData } = await supabase
          .from('receipts')
          .select('id, amount, paid_at, method, reference')
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setReceipt(receiptData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading invoice:', err);
      setError('Failed to load invoice');
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!invoice || !user || !profile) return;

    setProcessing(true);
    try {
      // Check for existing active payment request for this invoice
      const { data: existingRequest } = await supabase
        .from('payment_requests')
        .select('id, token_hash, expires_at')
        .eq('invoice_id', invoice.id)
        .eq('status', 'sent')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let token: string;

      if (existingRequest && existingRequest.token_hash) {
        // Reuse existing payment request
        token = existingRequest.token_hash;
      } else {
        // Create new payment request
        const newToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiry

        const { error: insertError } = await supabase
          .from('payment_requests')
          .insert({
            type: 'card_payment',
            invoice_id: invoice.id,
            user_id: user.id,
            customer_name: profile.full_name || 'Customer',
            customer_email: profile.email || user.email,
            account_number: profile.account_number,
            amount: invoice.total,
            currency: invoice.currency || 'GBP',
            status: 'sent',
            token_hash: newToken,
            expires_at: expiresAt.toISOString(),
            due_date: invoice.due_date,
          });

        if (insertError) {
          throw new Error('Failed to create payment request');
        }

        token = newToken;
      }

      // Redirect to payment page
      navigate(`/pay?token=${token}`);
    } catch (err) {
      console.error('Error creating payment request:', err);
      toast.error('Failed to start payment. Please try again.');
      setProcessing(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!receipt || !invoice || !profile) return;
    
    setGeneratingPdf(true);
    try {
      generateReceiptPdf({
        receiptId: receipt.id,
        invoiceNumber: invoice.invoice_number,
        customerName: profile.full_name || 'Customer',
        customerEmail: profile.email || '',
        accountNumber: profile.account_number || '',
        amount: receipt.amount,
        paidAt: receipt.paid_at,
        method: receipt.method || 'Card',
        reference: receipt.reference || receipt.id.slice(0, 8).toUpperCase(),
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-primary border-2 border-foreground">Paid</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive border-2 border-foreground">Overdue</Badge>;
      case 'sent':
        return <Badge className="bg-warning border-2 border-foreground">Awaiting Payment</Badge>;
      case 'draft':
        return <Badge className="bg-muted border-2 border-foreground">Draft</Badge>;
      default:
        return <Badge className="border-2 border-foreground">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-12 px-4">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invoice...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-12 px-4">
          <Card className="border-4 border-foreground">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => navigate('/dashboard')} className="border-4 border-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!invoice) {
    return null;
  }

  // Invoice already paid - show receipt
  if (invoice.status === 'paid') {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-12 px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="border-4 border-foreground overflow-hidden">
            <div className="bg-primary p-6 text-center">
              <CheckCircle className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
              <h2 className="font-display text-2xl text-primary-foreground">INVOICE PAID</h2>
            </div>
            
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border-4 border-foreground bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-foreground flex items-center justify-center">
                      <FileText className="w-5 h-5 text-background" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Invoice</p>
                      <p className="font-display">{invoice.invoice_number}</p>
                    </div>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>

                {receipt && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border-4 border-foreground">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground uppercase">Amount Paid</span>
                        </div>
                        <p className="font-display text-xl">£{receipt.amount.toFixed(2)}</p>
                      </div>
                      <div className="p-4 border-4 border-foreground">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground uppercase">Paid On</span>
                        </div>
                        <p className="font-display text-xl">{format(new Date(receipt.paid_at), 'dd MMM yyyy')}</p>
                      </div>
                    </div>

                    <div className="p-4 border-4 border-foreground bg-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground uppercase">Receipt Reference</span>
                      </div>
                      <p className="font-mono text-lg">{receipt.reference || receipt.id.slice(0, 8).toUpperCase()}</p>
                    </div>

                    <Button
                      onClick={handleDownloadReceipt}
                      disabled={generatingPdf}
                      className="w-full border-4 border-foreground"
                      variant="outline"
                    >
                      {generatingPdf ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Download Receipt
                    </Button>
                  </>
                )}

                <p className="text-center text-sm text-muted-foreground">
                  Thank you for your payment. A confirmation email has been sent.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Unpaid invoice - show payment option
  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Invoice Summary */}
        <Card className="mb-6 border-4 border-foreground">
          <CardHeader className="border-b-4 border-foreground">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-display">
                <FileText className="h-5 w-5" />
                Invoice {invoice.invoice_number}
              </CardTitle>
              {getStatusBadge(invoice.status)}
            </div>
            <CardDescription>
              Issued {format(new Date(invoice.issue_date), 'dd MMM yyyy')}
              {invoice.due_date && (
                <span className={isOverdue ? 'text-destructive font-semibold' : ''}>
                  {' '}• Due {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                  {isOverdue && ' (OVERDUE)'}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-6">
              <span className="text-muted-foreground">Outstanding Balance</span>
              <span className="font-display text-3xl">
                £{invoice.total.toFixed(2)}
              </span>
            </div>

            {isOverdue && (
              <div className="mb-6 p-4 border-2 border-destructive bg-destructive/10 text-sm">
                <p className="font-semibold text-destructive">⚠️ This invoice is overdue</p>
                <p className="text-muted-foreground mt-1">
                  Please pay immediately to avoid late fees and service interruptions.
                </p>
              </div>
            )}

            <Button
              onClick={handlePayNow}
              disabled={processing}
              className="w-full h-14 text-lg font-display"
              variant="hero"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Preparing Payment...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Pay Now — £{invoice.total.toFixed(2)}
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              You'll be redirected to our secure payment page
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>Need help? Call <strong>0800 260 6627</strong></p>
          <p>Lines open Mon–Fri 9am–6pm, Sat 9am–1pm</p>
        </div>
      </div>
    </Layout>
  );
}
