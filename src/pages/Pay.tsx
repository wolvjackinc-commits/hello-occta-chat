import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CreditCard, Shield, Loader2, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";

type PaymentRequestData = {
  id: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  account_number: string | null;
  invoice_number: string | null;
  due_date: string | null;
  status: string;
  expires_at: string | null;
};

export default function Pay() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const status = searchParams.get("status");
  const requestId = searchParams.get("requestId");

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentRequestData | null>(null);
  const [paymentResult, setPaymentResult] = useState<"success" | "failed" | "cancelled" | null>(null);

  // Handle return from Worldpay
  useEffect(() => {
    if (status && requestId) {
      if (status === "success") {
        setPaymentResult("success");
      } else if (status === "failed") {
        setPaymentResult("failed");
      } else if (status === "cancelled") {
        setPaymentResult("cancelled");
      }
      setIsLoading(false);
    }
  }, [status, requestId]);

  // Validate token and fetch payment data
  useEffect(() => {
    if (!token || status) return;

    const validateToken = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("payment-request", {
          body: {
            action: "validate-token",
            token,
            type: "card_payment",
          },
        });

        if (fnError) throw fnError;
        if (!data?.success) {
          setError(data?.error || "Invalid or expired payment link");
          return;
        }

        setPaymentData(data.request);
      } catch (err) {
        setError("Failed to validate payment link. Please contact support.");
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token, status]);

  const handleProceedToPayment = async () => {
    if (!paymentData || !token) return;

    setIsProcessing(true);
    try {
      const returnUrl = `${window.location.origin}/pay?requestId=${paymentData.id}`;

      const { data, error: fnError } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "create-worldpay-session",
          token,
          returnUrl,
        },
      });

      if (fnError) throw fnError;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to create payment session");
      }

      // Redirect to Worldpay
      window.location.href = data.checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment initialization failed";
      setError(message);
      setIsProcessing(false);
    }
  };

  // Result screens
  if (paymentResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-4 border-foreground">
          <CardContent className="pt-8 pb-8 text-center">
            {paymentResult === "success" ? (
              <>
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-primary-foreground" />
                </div>
                <h1 className="font-display text-3xl mb-2">Payment Successful</h1>
                <p className="text-muted-foreground mb-6">
                  Thank you for your payment. A confirmation email has been sent to you.
                </p>
                <Badge className="bg-primary">Receipt sent via email</Badge>
              </>
            ) : paymentResult === "failed" ? (
              <>
                <div className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="h-8 w-8 text-destructive-foreground" />
                </div>
                <h1 className="font-display text-3xl mb-2">Payment Failed</h1>
                <p className="text-muted-foreground mb-6">
                  Unfortunately, your payment could not be processed. Please try again or contact support.
                </p>
                <Button onClick={() => window.location.reload()} className="gap-2">
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h1 className="font-display text-3xl mb-2">Payment Cancelled</h1>
                <p className="text-muted-foreground mb-6">
                  You cancelled the payment. If you'd like to try again, please use the payment link from your email.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-4 border-foreground">
          <CardHeader className="bg-foreground text-background">
            <CardTitle className="font-display text-2xl text-center">OCCTA</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !paymentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-4 border-foreground">
          <CardHeader className="bg-foreground text-background">
            <CardTitle className="font-display text-2xl text-center">OCCTA</CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-destructive-foreground" />
            </div>
            <h2 className="font-display text-2xl mb-2">Invalid Link</h2>
            <p className="text-muted-foreground mb-6">
              {error || "This payment link is invalid or has expired."}
            </p>
            <p className="text-sm text-muted-foreground">
              Need help? Call <strong>{CONTACT_PHONE_DISPLAY}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-4 border-foreground">
        <CardHeader className="bg-foreground text-background">
          <CardTitle className="font-display text-2xl text-center tracking-widest">OCCTA</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-8">
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl mb-1">Secure Payment</h1>
            <p className="text-sm text-muted-foreground">
              Complete your payment securely via Worldpay
            </p>
          </div>

          <div className="border-4 border-foreground p-4 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount Due</span>
                <span className="font-display text-2xl">
                  £{paymentData.amount.toFixed(2)}
                </span>
              </div>
              {paymentData.invoice_number && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Invoice</span>
                  <span className="font-mono">{paymentData.invoice_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Account</span>
                <span className="font-mono">{paymentData.account_number || "—"}</span>
              </div>
              {paymentData.due_date && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <span>{new Date(paymentData.due_date).toLocaleDateString("en-GB")}</span>
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleProceedToPayment}
            disabled={isProcessing}
            className="w-full h-14 text-lg gap-2 font-display tracking-wide"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            {isProcessing ? "Redirecting..." : "Proceed to Pay"}
          </Button>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Secured by Worldpay • PCI DSS Compliant</span>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Questions? Call <strong>{CONTACT_PHONE_DISPLAY}</strong></p>
            <p>Lines open Mon–Fri 9am–6pm, Sat 9am–1pm</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
