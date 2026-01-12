import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, ShieldX, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface IdentityVerificationProps {
  accountNumber: string | null;
  dateOfBirth: string | null;
  onVerified: () => void;
  children: React.ReactNode;
  actionLabel?: string;
}

export const IdentityVerification = ({
  accountNumber,
  dateOfBirth,
  onVerified,
  children,
  actionLabel = "sensitive action",
}: IdentityVerificationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputAccountNumber, setInputAccountNumber] = useState("");
  const [inputDob, setInputDob] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<"success" | "failed" | null>(null);
  const [attempts, setAttempts] = useState(0);

  const maxAttempts = 3;

  const handleVerify = async () => {
    if (attempts >= maxAttempts) {
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    // Simulate verification delay for security
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const accountMatch = inputAccountNumber.toUpperCase().trim() === accountNumber?.toUpperCase().trim();
    const dobMatch = inputDob === dateOfBirth;

    if (accountMatch && dobMatch) {
      setVerificationResult("success");
      setTimeout(() => {
        setIsOpen(false);
        onVerified();
        // Reset state
        setInputAccountNumber("");
        setInputDob("");
        setVerificationResult(null);
        setAttempts(0);
      }, 1500);
    } else {
      setVerificationResult("failed");
      setAttempts((prev) => prev + 1);
    }

    setIsVerifying(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setInputAccountNumber("");
      setInputDob("");
      setVerificationResult(null);
    }
    setIsOpen(open);
  };

  const isLocked = attempts >= maxAttempts;

  // If user doesn't have account number or DOB set, show a message
  if (!accountNumber || !dateOfBirth) {
    return (
      <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="border-4 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-display-sm flex items-center gap-2">
              <Shield className="w-6 h-6" />
              IDENTITY VERIFICATION REQUIRED
            </DialogTitle>
            <DialogDescription>
              To access {actionLabel}, you need to complete your profile first.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-warning/10 border-2 border-warning/30 rounded">
            <p className="text-sm">
              Please update your profile with your date of birth to enable identity verification.
              Your account number is: <span className="font-mono font-bold">{accountNumber || "Not assigned"}</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="border-4 border-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-display-sm flex items-center gap-2">
            <Shield className="w-6 h-6" />
            VERIFY YOUR IDENTITY
          </DialogTitle>
          <DialogDescription>
            For your security, please verify your identity to access {actionLabel}.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {isLocked ? (
            <motion.div
              key="locked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-destructive text-destructive-foreground flex items-center justify-center border-4 border-foreground">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="font-display text-lg mb-2">VERIFICATION LOCKED</h3>
              <p className="text-sm text-muted-foreground">
                Too many failed attempts. Please contact support for assistance.
              </p>
            </motion.div>
          ) : verificationResult === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10 }}
                className="w-16 h-16 mx-auto mb-4 bg-primary text-primary-foreground flex items-center justify-center border-4 border-foreground"
              >
                <ShieldCheck className="w-8 h-8" />
              </motion.div>
              <h3 className="font-display text-lg text-primary">IDENTITY VERIFIED</h3>
              <p className="text-sm text-muted-foreground">Redirecting...</p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {verificationResult === "failed" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-destructive/10 border-2 border-destructive/30 flex items-center gap-2"
                >
                  <ShieldX className="w-5 h-5 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Verification failed</p>
                    <p className="text-xs text-muted-foreground">
                      {maxAttempts - attempts} attempts remaining
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="accountNumber" className="font-display uppercase">
                  Account Number
                </Label>
                <Input
                  id="accountNumber"
                  placeholder="e.g. OCC12345678"
                  value={inputAccountNumber}
                  onChange={(e) => setInputAccountNumber(e.target.value)}
                  className="border-2 border-foreground font-mono uppercase"
                  disabled={isVerifying}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob" className="font-display uppercase">
                  Date of Birth
                </Label>
                <Input
                  id="dob"
                  type="date"
                  value={inputDob}
                  onChange={(e) => setInputDob(e.target.value)}
                  className="border-2 border-foreground"
                  disabled={isVerifying}
                />
              </div>

              <Button
                onClick={handleVerify}
                disabled={!inputAccountNumber || !inputDob || isVerifying}
                className="w-full"
                variant="hero"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Verify Identity
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Enter the details exactly as shown on your account
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
