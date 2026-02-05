import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CreditCard, Shield, Loader2, AlertTriangle, Clock, Download, Home, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
import { getPaymentReturnOrigin } from "@/lib/appOrigin";
import { redirectToExternal } from "@/lib/externalRedirect";
import { generateReceiptPdf } from "@/lib/generateReceiptPdf";
import ConfettiEffect from "@/components/thankyou/ConfettiEffect";
import { motion } from "framer-motion";
import { format } from "date-fns";

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

type PaymentDetails = {
  invoiceNumber: string;
  amount: number;
  paidAt: string;
  reference: string;
  method: string;
  customerName: string;
  customerEmail: string;
  accountNumber: string;
  receiptId: string;
};

export default function Pay() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const status = searchParams.get("status");
  const requestId = searchParams.get("requestId");

  const stableOrigin = getPaymentReturnOrigin();
  const isRunningOnStableOrigin =
    typeof window === "undefined" ? true : window.location.origin === stableOrigin;

  const shouldOpenOnStableOrigin = !isRunningOnStableOrigin && !!token && !status;

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentRequestData | null>(null);
  const [paymentResult, setPaymentResult] = useState<"success" | "failed" | "cancelled" | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);

  // Handle return from Worldpay - VERIFY PAYMENT with backend
  useEffect(() => {
    if (!status || !requestId) return;
    
    const verifyPayment = async () => {
      console.log('[Pay] Verifying payment with backend:', { requestId, status });
      
      try {
        // Call verify-payment to trigger backend processing (invoice update, receipt, email)
        const { data, error } = await supabase.functions.invoke("payment-request", {
          body: {
            action: "verify-payment",
            requestId,
            status,
          },
        });
        
        if (error) {
          console.error('[Pay] Verification function error:', error);
          // Still show result based on Worldpay status (payment already went through)
        } else if (!data?.success) {
          console.error('[Pay] Verification failed:', data?.error);
          // Still show result - Worldpay already processed the payment
        } else {
          console.log('[Pay] Payment verified successfully:', data);
        }
      } catch (err) {
        console.error('[Pay] Error calling verify-payment:', err);
        // Don't block UI - the payment already happened at Worldpay
      } finally {
        // Set result based on URL status (Worldpay's determination)
        if (status === "success") {
          setPaymentResult("success");
        } else if (status === "failed") {
          setPaymentResult("failed");
        } else if (status === "cancelled") {
          setPaymentResult("cancelled");
        }
        setIsLoading(false);
      }
    };
    
    verifyPayment();
  }, [status, requestId]);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  // Fetch payment details on success
  useEffect(() => {
    if (paymentResult !== "success" || !requestId) return;

    const fetchPaymentDetails = async () => {
      try {
        // Fetch payment request
        const { data: paymentRequest, error: prError } = await supabase
          .from("payment_requests")
          .select("id, amount, invoice_id, customer_name, customer_email, account_number")
          .eq("id", requestId)
          .single();

        if (prError || !paymentRequest) {
          console.error("Failed to fetch payment request:", prError);
          return;
        }

        // Fetch invoice
        let invoiceNumber = "—";
        if (paymentRequest.invoice_id) {
          const { data: invoice } = await supabase
            .from("invoices")
            .select("invoice_number")
            .eq("id", paymentRequest.invoice_id)
            .single();
          if (invoice) invoiceNumber = invoice.invoice_number;
        }

        // Fetch receipt
        let receiptRef = "";
        let paidAt = new Date().toISOString();
        let receiptId = "";
        if (paymentRequest.invoice_id) {
          const { data: receipt } = await supabase
            .from("receipts")
            .select("id, reference, paid_at")
            .eq("invoice_id", paymentRequest.invoice_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          if (receipt) {
            receiptRef = receipt.reference || "";
            paidAt = receipt.paid_at;
            receiptId = receipt.id;
          }
        }

        setPaymentDetails({
          invoiceNumber,
          amount: paymentRequest.amount || 0,
          paidAt,
          reference: receiptRef,
          method: "Card",
          customerName: paymentRequest.customer_name || "",
          customerEmail: paymentRequest.customer_email || "",
          accountNumber: paymentRequest.account_number || "",
          receiptId,
        });
      } catch (err) {
        console.error("Error fetching payment details:", err);
      }
    };

    fetchPaymentDetails();
  }, [paymentResult, requestId]);

  // Validate token and fetch payment data
  useEffect(() => {
    if (!token || status || shouldOpenOnStableOrigin) return;

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
      } catch (err: any) {
        // Expose a useful error to users (and for debugging), while staying safe.
        const message =
          typeof err?.message === "string" && err.message.trim().length
            ? err.message
            : "Failed to validate payment link. Please contact support.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token, status, shouldOpenOnStableOrigin]);

  // If this page is opened inside the Lovable preview domain, 3DS flows can crash with
  // "The current origin is not supported". Always move the customer to the stable/published
  // domain BEFORE starting Worldpay.
  if (shouldOpenOnStableOrigin) {
    const stableUrl = `${stableOrigin}/pay?${searchParams.toString()}`;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-4 border-foreground">
          <CardHeader className="bg-foreground text-background">
            <CardTitle className="font-display text-2xl text-center tracking-widest">OCCTA</CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <h1 className="font-display text-2xl">Open Secure Payment</h1>
            <p className="text-muted-foreground">
              For security reasons, card payments must be completed outside the preview.
            </p>
            <Button className="w-full" onClick={() => redirectToExternal(stableUrl)}>
              Open payment page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleProceedToPayment = async () => {
    if (!paymentData || !token) return;

    setIsProcessing(true);
    try {
      // IMPORTANT: use a stable origin for payment provider return URLs.
      // Preview origins can break Worldpay 3DS ("current origin is not supported").
      const paymentOrigin = getPaymentReturnOrigin();
      const returnUrl = `${paymentOrigin}/pay?requestId=${paymentData.id}`;
      
      console.log('[Pay] Starting payment session:', { paymentOrigin, returnUrl });

      const { data, error: fnError } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "create-worldpay-session",
          token,
          returnUrl,
          paymentOrigin,
        },
      });

      if (fnError) throw fnError;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to create payment session");
      }

      // Redirect to Worldpay
      redirectToExternal(data.checkoutUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment initialization failed";
      setError(message);
      setIsProcessing(false);
    }
  };

  const handleDownloadReceipt = useCallback(() => {
    if (!paymentDetails) return;
    generateReceiptPdf({
      receiptId: paymentDetails.receiptId,
      invoiceNumber: paymentDetails.invoiceNumber,
      customerName: paymentDetails.customerName,
      customerEmail: paymentDetails.customerEmail,
      accountNumber: paymentDetails.accountNumber,
      amount: paymentDetails.amount,
      paidAt: paymentDetails.paidAt,
      method: paymentDetails.method,
      reference: paymentDetails.reference,
    });
  }, [paymentDetails]);

  const handleNavigation = () => {
    if (isLoggedIn) navigate("/dashboard");
    else navigate("/");
  };

  // Result screens
  if (paymentResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {paymentResult === "success" && <ConfettiEffect />}
        <Card className="w-full max-w-md border-4 border-foreground">
          <CardContent className="pt-8 pb-8">
            {paymentResult === "success" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                {/* Animated checkmark with pulsing rings */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                  className="relative mx-auto w-20 h-20 mb-6"
                >
                  <motion.div
                    className="absolute inset-0 bg-primary/20 border-4 border-primary/30 rounded-full"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-primary/20 border-4 border-primary/30 rounded-full"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5, ease: "easeOut", delay: 0.3 }}
                  />
                  <div className="w-20 h-20 bg-primary border-4 border-foreground rounded-full flex items-center justify-center relative z-10">
                    <motion.svg
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="w-10 h-10 text-primary-foreground"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <motion.path d="M5 12l5 5L20 7" />
                    </motion.svg>
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-display text-3xl mb-2"
                >
                  Payment Successful!
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-muted-foreground mb-6"
                >
                  Thank you for your payment. A confirmation email has been sent.
                </motion.p>

                {/* Transaction Details */}
                {paymentDetails && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="border-4 border-foreground p-4 mb-6 text-left"
                  >
                    <h3 className="font-display text-sm uppercase tracking-widest mb-3 border-b-2 border-foreground pb-2">
                      Transaction Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invoice</span>
                        <span className="font-mono font-semibold">{paymentDetails.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-display text-lg">£{paymentDetails.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span>{format(new Date(paymentDetails.paidAt), "dd MMM yyyy, HH:mm")}</span>
                      </div>
                      {paymentDetails.reference && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reference</span>
                          <span className="font-mono">{paymentDetails.reference}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Method</span>
                        <span>{paymentDetails.method}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-3"
                >
                  {paymentDetails && (
                    <Button onClick={handleDownloadReceipt} variant="outline" className="w-full gap-2 border-2 border-foreground">
                      <Download className="h-4 w-4" />
                      Download Receipt
                    </Button>
                  )}
                  <Button onClick={handleNavigation} className="w-full gap-2">
                    {isLoggedIn ? <LayoutDashboard className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                    {isLoggedIn ? "Go to Dashboard" : "Back to Home"}
                  </Button>
                </motion.div>
              </motion.div>
            ) : paymentResult === "failed" ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="h-8 w-8 text-destructive-foreground" />
                </div>
                <h1 className="font-display text-3xl mb-2">Payment Failed</h1>
                <p className="text-muted-foreground mb-6">
                  Unfortunately, your payment could not be processed. Please try again or contact support.
                </p>
                <div className="space-y-3">
                  <Button onClick={() => window.location.reload()} className="w-full gap-2">
                    Try Again
                  </Button>
                  <Button onClick={handleNavigation} variant="outline" className="w-full gap-2 border-2 border-foreground">
                    {isLoggedIn ? "Go to Dashboard" : "Back to Home"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-muted border-2 border-foreground rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h1 className="font-display text-3xl mb-2">Payment Cancelled</h1>
                <p className="text-muted-foreground mb-6">
                  You cancelled the payment. If you'd like to try again, please use the payment link from your email.
                </p>
                <div className="space-y-3">
                  <Button onClick={handleNavigation} className="w-full gap-2">
                    {isLoggedIn ? <LayoutDashboard className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                    {isLoggedIn ? "Go to Dashboard" : "Back to Home"}
                  </Button>
                </div>
              </div>
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
