import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { WorldpayCheckout } from '@/components/payment/WorldpayCheckout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { format } from 'date-fns';

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
}

export default function PayInvoice() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

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
        .select('email, full_name')
        .eq('id', currentUser.id)
        .single();

      setProfile(profileData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading invoice:', err);
      setError('Failed to load invoice');
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Refresh invoice data
    checkAuthAndLoadInvoice();
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
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => navigate('/dashboard')}>
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

  // Invoice already paid
  if (invoice.status === 'paid') {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-12 px-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invoice Already Paid</h3>
              <p className="text-muted-foreground mb-4">
                Invoice {invoice.invoice_number} has already been paid.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice {invoice.invoice_number}
            </CardTitle>
            <CardDescription>
              Issued {format(new Date(invoice.issue_date), 'dd MMM yyyy')}
              {invoice.due_date && (
                <> • Due {format(new Date(invoice.due_date), 'dd MMM yyyy')}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount Due</span>
              <span className="text-2xl font-bold">
                £{invoice.total.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <WorldpayCheckout
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          amount={invoice.total}
          currency={invoice.currency}
          customerEmail={profile?.email || user?.email || ''}
          customerName={profile?.full_name || 'Customer'}
          userId={user?.id}
          onSuccess={handlePaymentSuccess}
          onCancel={() => navigate('/dashboard')}
        />
      </div>
    </Layout>
  );
}
