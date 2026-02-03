import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, X, Send, Eye, Users, User, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
};

type SendMode = "select" | "all";

export const QuickEmailTab = () => {
  const [sendMode, setSendMode] = useState<SendMode>("select");
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [subject, setSubject] = useState("");
  const [greeting, setGreeting] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  // Fetch customers for search
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["quick-email-customers", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, account_number")
        .not("email", "is", null)
        .order("full_name")
        .limit(50);

      if (searchTerm.trim()) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,account_number.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
    enabled: sendMode === "select",
  });

  // Fetch all customers count for "Send to All" confirmation
  const { data: allCustomersCount = 0 } = useQuery({
    queryKey: ["all-customers-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("email", "is", null);

      if (error) throw error;
      return count || 0;
    },
  });

  const handleToggleCustomer = (customer: Customer) => {
    setSelectedCustomers((prev) => {
      const exists = prev.find((c) => c.id === customer.id);
      if (exists) {
        return prev.filter((c) => c.id !== customer.id);
      }
      return [...prev, customer];
    });
  };

  const handleRemoveCustomer = (customerId: string) => {
    setSelectedCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  const validateForm = () => {
    if (!subject.trim()) {
      toast.error("Please enter an email subject");
      return false;
    }
    if (!body.trim()) {
      toast.error("Please enter email content");
      return false;
    }
    if (sendMode === "select" && selectedCustomers.length === 0) {
      toast.error("Please select at least one recipient");
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (!validateForm()) return;
    setShowPreview(true);
  };

  const handleSend = async () => {
    if (!validateForm()) return;

    if (sendMode === "all") {
      setShowConfirmAll(true);
      return;
    }

    await sendEmails(selectedCustomers);
  };

  const sendEmails = async (recipients: Customer[]) => {
    setIsSending(true);
    setSendResult(null);

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      if (!recipient.email) {
        failed++;
        continue;
      }

      try {
        const { error } = await supabase.functions.invoke("send-email", {
          body: {
            type: "custom_admin",
            to: recipient.email,
            logToCommunications: true,
            userId: recipient.id,
            data: {
              subject,
              title: title || "Message from OCCTA",
              greeting: greeting || `Dear ${recipient.full_name || "Customer"}`,
              html_body: body.replace(/\n/g, "<br>"),
            },
          },
        });

        if (error) {
          console.error(`Failed to send to ${recipient.email}:`, error);
          failed++;
        } else {
          sent++;
        }
      } catch (err) {
        console.error(`Error sending to ${recipient.email}:`, err);
        failed++;
      }
    }

    setIsSending(false);
    setSendResult({ sent, failed });

    if (failed === 0) {
      toast.success(`Successfully sent ${sent} email${sent !== 1 ? "s" : ""}`);
      resetForm();
    } else {
      toast.warning(`Sent ${sent} email${sent !== 1 ? "s" : ""}, ${failed} failed`);
    }
  };

  const handleSendToAll = async () => {
    setShowConfirmAll(false);

    // Fetch all customers with email
    const { data: allCustomers, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_number")
      .not("email", "is", null);

    if (error) {
      toast.error("Failed to fetch customers");
      return;
    }

    await sendEmails(allCustomers as Customer[]);
  };

  const resetForm = () => {
    setSubject("");
    setGreeting("");
    setTitle("");
    setBody("");
    setSelectedCustomers([]);
    setSendMode("select");
  };

  // Filter out already selected customers from search results
  const availableCustomers = customers.filter(
    (c) => !selectedCustomers.find((sc) => sc.id === c.id)
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Send quick operational emails to customers. Emails are automatically logged and tracked.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Recipients */}
        <Card className="border-2 border-foreground">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Recipients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <Button
                variant={sendMode === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setSendMode("select")}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                Select Customers
              </Button>
              <Button
                variant={sendMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSendMode("all")}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                All Customers ({allCustomersCount})
              </Button>
            </div>

            {sendMode === "select" && (
              <>
                {/* Selected badges */}
                {selectedCustomers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedCustomers.map((customer) => (
                      <Badge
                        key={customer.id}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {customer.full_name || customer.email}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 hover:bg-transparent"
                          onClick={() => handleRemoveCustomer(customer.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search customers by name, email, or account..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Customer list */}
                <ScrollArea className="h-[200px] rounded-lg border p-2">
                  {isLoadingCustomers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableCustomers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {searchTerm ? "No customers found" : "Start typing to search"}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {availableCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted cursor-pointer"
                          onClick={() => handleToggleCustomer(customer)}
                        >
                          <Checkbox
                            checked={selectedCustomers.some((c) => c.id === customer.id)}
                            onCheckedChange={() => handleToggleCustomer(customer)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {customer.full_name || "No name"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {customer.email}
                              {customer.account_number && ` · ${customer.account_number}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}

            {sendMode === "all" && (
              <div className="rounded-lg border-2 border-dashed border-primary bg-primary/10 p-4">
                <p className="text-sm font-medium text-foreground">
                  ⚠️ This will send to all {allCustomersCount} customers with email addresses.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You'll be asked to confirm before sending.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Email Content */}
        <Card className="border-2 border-foreground">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="h-5 w-5" />
              Email Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="e.g. Important Service Update"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Email Title Banner</Label>
              <Input
                id="title"
                placeholder="e.g. Service Update (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Appears in the yellow banner. Defaults to "Message from OCCTA".
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="greeting">Custom Greeting</Label>
              <Input
                id="greeting"
                placeholder="e.g. Dear Mr Smith (optional)"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-generate from customer name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body *</Label>
              <Textarea
                id="body"
                placeholder="Type your message here...

You can use line breaks for paragraphs.

The email will be sent with full OCCTA branding and standard footer."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[180px] resize-none"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handlePreview} disabled={isSending}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button onClick={handleSend} disabled={isSending}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Email{sendMode === "select" && selectedCustomers.length > 1 ? "s" : ""}
              {sendMode === "select" && selectedCustomers.length > 0 && (
                <span className="ml-1">({selectedCustomers.length})</span>
              )}
              {sendMode === "all" && <span className="ml-1">({allCustomersCount})</span>}
            </>
          )}
        </Button>
      </div>

      {/* Send Result */}
      {sendResult && (
        <div className="flex items-center justify-center gap-2 text-sm text-primary">
          <CheckCircle className="h-4 w-4" />
          <span>
            {sendResult.sent} sent
            {sendResult.failed > 0 && `, ${sendResult.failed} failed`}
          </span>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how the email will appear to recipients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex gap-2">
                <span className="text-sm font-medium text-muted-foreground w-16">To:</span>
                <span className="text-sm">
                  {sendMode === "all"
                    ? `All customers (${allCustomersCount})`
                    : selectedCustomers.map((c) => c.email).join(", ")}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm font-medium text-muted-foreground w-16">Subject:</span>
                <span className="text-sm font-medium">{subject}</span>
              </div>
            </div>

            {/* Email preview mock */}
            <div className="rounded-lg border-4 border-foreground overflow-hidden">
              {/* Header */}
              <div className="bg-foreground p-4 text-background">
                <div className="font-display text-xl tracking-wider">OCCTA</div>
                <div className="text-xs text-primary tracking-wider">TELECOM • CONNECTED</div>
              </div>

              {/* Title banner */}
              <div className="bg-primary border-b-4 border-foreground px-4 py-3">
                <div className="font-display text-lg tracking-wide uppercase text-primary-foreground">
                  {title || "Message from OCCTA"}
                </div>
              </div>

              {/* Content */}
              <div className="bg-background p-6 space-y-4">
                <p className="font-semibold">
                  {greeting || "Dear Customer"},
                </p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {body}
                </div>
              </div>

              {/* Footer mock */}
              <div className="bg-foreground p-4 text-center text-xs text-muted-foreground">
                <p>OCCTA Limited • 0800 260 6626 • hello@occta.co.uk</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false);
                handleSend();
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Send to All Dialog */}
      <AlertDialog open={showConfirmAll} onOpenChange={setShowConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to All Customers?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the email to <strong>{allCustomersCount}</strong> customers.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendToAll}>
              Yes, Send to All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
