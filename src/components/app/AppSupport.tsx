import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  ChevronRight,
  Send,
  Loader2,
  HelpCircle,
  FileText,
  CreditCard,
  Wifi,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const faqItems = [
  { icon: Wifi, question: "How do I check my broadband speed?", link: "/support" },
  { icon: CreditCard, question: "How do I update my payment method?", link: "/dashboard" },
  { icon: FileText, question: "Where can I find my invoices?", link: "/dashboard" },
  { icon: HelpCircle, question: "How do I cancel my service?", link: "/support" },
];

const contactOptions = [
  { icon: Phone, label: "Call Us", value: "0800 123 4567", action: "tel:08001234567" },
  { icon: Mail, label: "Email", value: "support@occta.com", action: "mailto:support@occta.com" },
];

const AppSupport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in both subject and message",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to submit a support ticket",
        });
        navigate("/auth");
        return;
      }

      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: subject.trim(),
        description: message.trim(),
        status: "open",
        priority: "medium",
      });

      if (error) throw error;

      toast({
        title: "Ticket submitted!",
        description: "We'll get back to you soon",
      });
      setSubject("");
      setMessage("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      className="px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Contact Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Contact Us
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {contactOptions.map((option) => (
            <a
              key={option.label}
              href={option.action}
              className="flex flex-col items-center gap-2 p-4 bg-card border-4 border-foreground text-center active:bg-secondary"
            >
              <option.icon className="w-6 h-6" />
              <span className="font-display text-sm uppercase">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.value}</span>
            </a>
          ))}
        </div>
      </motion.div>

      {/* Quick Ticket Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Submit a Ticket
        </h2>
        <div className="p-4 bg-card border-4 border-foreground space-y-3">
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border-2 border-foreground"
          />
          <Textarea
            placeholder="How can we help?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border-2 border-foreground min-h-[100px]"
          />
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
            variant="hero"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Common Questions
        </h2>
        <div className="bg-card border-4 border-foreground divide-y-2 divide-foreground">
          {faqItems.map((item) => (
            <Link
              key={item.question}
              to={item.link}
              className="flex items-center gap-3 p-4 active:bg-secondary transition-colors"
            >
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm">{item.question}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AppSupport;
