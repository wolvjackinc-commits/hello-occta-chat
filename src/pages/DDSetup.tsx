import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Shield, Loader2, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";

type DDRequestData = {
  id: string;
  customer_name: string;
  customer_email: string;
  account_number: string | null;
  user_id: string;
  status: string;
};

const DD_GUARANTEE_TEXT = `This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.

If there are any changes to the amount, date or frequency of your Direct Debit, OCCTA Limited will notify you (normally 10 working days) in advance of your account being debited or as otherwise agreed. If you request OCCTA Limited to collect a payment, confirmation of the amount and date will be given to you at the time of the request.

If an error is made in the payment of your Direct Debit, by OCCTA Limited or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.

If you receive a refund you are not entitled to, you must pay it back when OCCTA Limited asks you to.

You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.`;

export default function DDSetup() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<DDRequestData | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Form state
  const [form, setForm] = useState({
    accountHolderName: "",
    sortCode: "",
    accountNumber: "",
    billingAddress: "",
    signatureName: "",
    confirmAccountHolder: false,
    confirmGuarantee: false,
  });

  // Validate token and fetch request data
  useEffect(() => {
    if (!token) {
      setError("No token provided");
      setIsLoading(false);
      return;
    }

    const validateToken = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("payment-request", {
          body: {
            action: "validate-token",
            token,
            type: "dd_setup",
          },
        });

        if (fnError) throw fnError;
        if (!data?.success) {
          setError(data?.error || "Invalid or expired link");
          return;
        }

        setRequestData(data.request);
        setForm((prev) => ({
          ...prev,
          accountHolderName: data.request.customer_name || "",
        }));
      } catch (err) {
        setError("Failed to validate link. Please contact support.");
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const formatSortCode = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.accountHolderName.trim()) {
      toast({ title: "Account holder name is required", variant: "destructive" });
      return;
    }
    const sortCodeDigits = form.sortCode.replace(/\D/g, "");
    if (sortCodeDigits.length !== 6) {
      toast({ title: "Sort code must be 6 digits", variant: "destructive" });
      return;
    }
    if (form.accountNumber.length < 8 || !/^\d+$/.test(form.accountNumber)) {
      toast({ title: "Account number must be 8 digits", variant: "destructive" });
      return;
    }
    if (!form.signatureName.trim()) {
      toast({ title: "Please type your name to confirm", variant: "destructive" });
      return;
    }
    if (!form.confirmAccountHolder) {
      toast({ title: "Please confirm you are the account holder", variant: "destructive" });
      return;
    }
    if (!form.confirmGuarantee) {
      toast({ title: "Please confirm you have read the Direct Debit Guarantee", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "submit-dd-mandate",
          token,
          mandateData: {
            accountHolderName: form.accountHolderName.trim(),
            sortCode: sortCodeDigits,
            accountNumber: form.accountNumber.trim(),
            billingAddress: form.billingAddress.trim() || null,
            signatureName: form.signatureName.trim(),
            consentIp: null, // Will be captured server-side
            consentUserAgent: navigator.userAgent,
          },
        },
      });

      if (fnError) throw fnError;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to submit mandate");
      }

      setIsComplete(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-4 border-foreground">
          <CardHeader className="bg-foreground text-background">
            <CardTitle className="font-display text-2xl text-center tracking-widest">OCCTA</CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl mb-2">Direct Debit Submitted</h1>
            <p className="text-muted-foreground mb-6">
              Thank you! Your Direct Debit instruction has been received and is awaiting verification.
            </p>
            <div className="bg-muted p-4 rounded-lg text-left text-sm">
              <p className="font-medium mb-2">What happens next?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• We'll verify your bank details (1-2 business days)</li>
                <li>• You'll receive a confirmation email once verified</li>
                <li>• Your first payment will be collected as agreed</li>
              </ul>
            </div>
            <div className="mt-4 p-3 bg-primary/10 rounded-lg text-sm">
              <p className="text-primary font-medium">Status: Pending Verification</p>
              <p className="text-muted-foreground text-xs mt-1">
                An admin will review and verify your mandate shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-4 border-foreground">
          <CardHeader className="bg-foreground text-background">
            <CardTitle className="font-display text-2xl text-center">OCCTA</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !requestData) {
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
              {error || "This Direct Debit setup link is invalid or has expired."}
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
    <div className="min-h-screen bg-background py-8 px-4">
      <Card className="w-full max-w-lg mx-auto border-4 border-foreground">
        <CardHeader className="bg-foreground text-background">
          <CardTitle className="font-display text-2xl text-center tracking-widest">OCCTA</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <Building2 className="h-6 w-6" />
              <h1 className="font-display text-2xl">Direct Debit Setup</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Set up automatic payments for your OCCTA account
            </p>
          </div>

          <div className="bg-muted p-3 rounded-lg mb-6 text-sm">
            <p><strong>Account:</strong> {requestData.account_number}</p>
            <p><strong>For:</strong> {requestData.customer_name}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountHolderName">Account Holder Name *</Label>
              <Input
                id="accountHolderName"
                placeholder="Name on bank account"
                value={form.accountHolderName}
                onChange={(e) => setForm((prev) => ({ ...prev, accountHolderName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sortCode">Sort Code *</Label>
                <Input
                  id="sortCode"
                  placeholder="00-00-00"
                  value={form.sortCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortCode: formatSortCode(e.target.value) }))}
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number *</Label>
                <Input
                  id="accountNumber"
                  placeholder="12345678"
                  value={form.accountNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                  maxLength={8}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingAddress">Billing Address (optional)</Label>
              <Textarea
                id="billingAddress"
                placeholder="Enter billing address if different from account address"
                value={form.billingAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, billingAddress: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Direct Debit Guarantee */}
            <div className="border-4 border-foreground p-4 mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg">The Direct Debit Guarantee</h3>
              </div>
              <div className="bg-muted p-3 rounded text-xs leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                {DD_GUARANTEE_TEXT}
              </div>
            </div>

            {/* Confirmations */}
            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirmAccountHolder"
                  checked={form.confirmAccountHolder}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, confirmAccountHolder: checked === true }))
                  }
                />
                <Label htmlFor="confirmAccountHolder" className="text-sm leading-tight cursor-pointer">
                  I confirm I am the account holder and authorise OCCTA Limited to set up a Direct Debit mandate on the above account.
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirmGuarantee"
                  checked={form.confirmGuarantee}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, confirmGuarantee: checked === true }))
                  }
                />
                <Label htmlFor="confirmGuarantee" className="text-sm leading-tight cursor-pointer">
                  I have read and understand the Direct Debit Guarantee.
                </Label>
              </div>
            </div>

            {/* Signature */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="signatureName">
                Type your full name to confirm (e-signature) *
              </Label>
              <Input
                id="signatureName"
                placeholder="Your full name"
                value={form.signatureName}
                onChange={(e) => setForm((prev) => ({ ...prev, signatureName: e.target.value }))}
                className="font-serif italic text-lg"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !form.confirmAccountHolder || !form.confirmGuarantee}
              className="w-full h-14 text-lg gap-2 font-display tracking-wide mt-4"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
              {isSubmitting ? "Submitting..." : "Set Up Direct Debit"}
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Bank details encrypted • Your data is secure</span>
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
