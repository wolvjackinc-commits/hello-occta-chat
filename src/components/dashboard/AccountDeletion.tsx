import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  Loader2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

interface AccountDeletionProps {
  userEmail: string;
}

export const AccountDeletion = ({ userEmail }: AccountDeletionProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<"initial" | "confirm">("initial");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (emailConfirm.toLowerCase() !== userEmail.toLowerCase()) {
      toast({
        title: "Email doesn't match",
        description: "Please enter your email address exactly as shown.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmEmail: emailConfirm, reason },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to delete account");
      }

      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted. You will be signed out.",
      });

      // Sign out and redirect
      await supabase.auth.signOut();
      navigate("/");
    } catch (err: any) {
      console.error("Account deletion error:", err);
      toast({
        title: "Deletion failed",
        description: err.message || "Could not delete your account. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="border-4 border-destructive bg-destructive/5 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-destructive text-destructive-foreground flex items-center justify-center shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg text-destructive">DELETE ACCOUNT</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete your OCCTA account and all associated data. This action cannot be undone.
          </p>
          
          <div className="mt-4 p-4 bg-background border-2 border-destructive/30">
            <p className="text-sm font-medium mb-2">What will be deleted:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your profile and personal information</li>
              <li>• All orders and service history</li>
              <li>• Support tickets and messages</li>
              <li>• Billing settings and payment history</li>
              <li>• All uploaded documents</li>
            </ul>
          </div>

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="mt-4 border-4 border-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-4 border-foreground">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 font-display">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  CONFIRM ACCOUNT DELETION
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p>
                      This will permanently delete your account. All your data will be removed and cannot be recovered.
                    </p>
                    
                    <AnimatePresence mode="wait">
                      {step === "initial" ? (
                        <motion.div
                          key="initial"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div className="p-4 bg-destructive/10 border-2 border-destructive/30">
                            <p className="text-sm font-medium text-destructive">
                              Before proceeding, please ensure:
                            </p>
                            <ul className="text-sm mt-2 space-y-1">
                              <li>• You have no active services</li>
                              <li>• All outstanding invoices are paid</li>
                              <li>• You have downloaded any documents you need</li>
                            </ul>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="confirm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div>
                            <Label htmlFor="email-confirm" className="text-sm font-medium">
                              Type your email to confirm: <span className="font-mono text-xs">{userEmail}</span>
                            </Label>
                            <Input
                              id="email-confirm"
                              type="email"
                              value={emailConfirm}
                              onChange={(e) => setEmailConfirm(e.target.value)}
                              placeholder="Enter your email address"
                              className="mt-2 border-4 border-foreground"
                            />
                          </div>
                          <div>
                            <Label htmlFor="reason" className="text-sm font-medium">
                              Reason for leaving (optional)
                            </Label>
                            <Textarea
                              id="reason"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Help us improve by sharing why you're leaving..."
                              className="mt-2 border-4 border-foreground"
                              rows={3}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={() => {
                    setStep("initial");
                    setEmailConfirm("");
                    setReason("");
                  }}
                  className="border-4 border-foreground"
                >
                  Cancel
                </AlertDialogCancel>
                {step === "initial" ? (
                  <Button
                    variant="destructive"
                    onClick={() => setStep("confirm")}
                    className="border-4 border-destructive"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting || emailConfirm.toLowerCase() !== userEmail.toLowerCase()}
                    className="border-4 border-destructive"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Permanently Delete
                      </>
                    )}
                  </Button>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};
