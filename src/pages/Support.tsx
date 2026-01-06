import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Search, 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  FileText, 
  CreditCard, 
  Settings, 
  HelpCircle,
  MessageSquare,
  Phone,
  Mail
} from "lucide-react";

const categories = [
  { icon: Wifi, label: "Broadband", description: "Speed issues, connection problems, router help" },
  { icon: Smartphone, label: "Mobile", description: "SIM activation, data usage, coverage" },
  { icon: PhoneCall, label: "Landline", description: "Call quality, features, voicemail" },
  { icon: FileText, label: "Billing", description: "Invoices, payments, account balance" },
  { icon: CreditCard, label: "Payments", description: "Payment methods, direct debit, refunds" },
  { icon: Settings, label: "Account", description: "Password, details, preferences" },
];

const faqs = [
  {
    question: "How do I check my broadband speed?",
    answer: "Pop over to speedtest.net or use our app. If you're getting less than half your plan speed over WiFi, try testing with an ethernet cable. Still slow? Give us a bell on 0800 260 6627 and we'll sort it.",
  },
  {
    question: "Can I keep my phone number when switching?",
    answer: "Absolutely! For mobile, text 'PAC' to 65075 to get your porting code. For landlines, just let us know your current number and we'll handle the rest. Takes about 10 working days.",
  },
  {
    question: "What happens if I go over my data limit?",
    answer: "We don't charge for going over – we're not monsters. You'll just slow down to 1Mbps until your next billing date. Or you can buy a data boost in the app for £5.",
  },
  {
    question: "How do I cancel my service?",
    answer: "We hope you won't! But if you need to, just log in to your dashboard or call us. 30 days notice required. No exit fees on our rolling contracts because, again, not monsters.",
  },
  {
    question: "My internet keeps dropping. What should I do?",
    answer: "First, try the classic: turn the router off, count to 30, turn it back on. Still dodgy? Check if other devices have the same issue. If it's just one device, the problem's probably with that. If it's everything, call us and we'll run diagnostics.",
  },
  {
    question: "How do I set up my WiFi router?",
    answer: "We send it pre-configured! Just plug the grey cable into the master socket, wait for the lights to go green (about 5 minutes), and connect using the WiFi details on the sticker. Easy peasy.",
  },
  {
    question: "Can I use my landline abroad?",
    answer: "Not directly, but download our app and you can make calls using your landline number over WiFi from anywhere in the world. Same rates as calling from home.",
  },
  {
    question: "What's the difference between 4G and 5G?",
    answer: "5G is faster – like, a lot faster. Great for streaming, gaming, and downloading. But 4G is still perfectly good for most things. Your phone needs to support 5G to use it, and you need to be in a 5G area.",
  },
];

const Support = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 hero-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
              How can we help?
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Stuck on something? We've got answers. And if we don't, we've got real humans who do.
            </p>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for help (e.g., 'slow internet', 'change password')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 bg-secondary/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-display font-bold text-center mb-8">
            Browse by category
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {categories.map((category) => (
              <Card 
                key={category.label} 
                className="cursor-pointer hover:shadow-soft hover:border-primary/30 transition-all duration-300"
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <category.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">{category.label}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            
            {filteredFaqs.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-4">
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`item-${index}`}
                    className="border border-border rounded-xl px-6 data-[state=open]:bg-secondary/30"
                  >
                    <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-12">
                <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No results found for "{searchQuery}". Try a different search or contact us directly.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-16 bg-navy">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-center text-navy-foreground mb-4">
              Still stuck? We're here to help.
            </h2>
            <p className="text-center text-navy-foreground/70 mb-12">
              Our support team is based in Yorkshire and actually understands broadband. Shocking, we know.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-navy-foreground/5 border-navy-foreground/10">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-navy-foreground mb-2">Call Us</h3>
                  <p className="text-sm text-navy-foreground/70 mb-4">
                    Mon-Fri 8am-8pm, Sat 9am-5pm
                  </p>
                  <a href="tel:08002606627">
                    <Button variant="hero" className="w-full">
                      0800 260 6627
                    </Button>
                  </a>
                </CardContent>
              </Card>

              <Card className="bg-navy-foreground/5 border-navy-foreground/10">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="font-display font-bold text-navy-foreground mb-2">Live Chat</h3>
                  <p className="text-sm text-navy-foreground/70 mb-4">
                    Quick questions? Chat with us now.
                  </p>
                  <Button variant="outline" className="w-full border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/10">
                    Start Chat
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-foreground/5 border-navy-foreground/10">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-7 h-7 text-warning" />
                  </div>
                  <h3 className="font-display font-bold text-navy-foreground mb-2">Email Us</h3>
                  <p className="text-sm text-navy-foreground/70 mb-4">
                    We reply within 24 hours. Promise.
                  </p>
                  <a href="mailto:support@occtatele.com">
                    <Button variant="outline" className="w-full border-navy-foreground/20 text-navy-foreground hover:bg-navy-foreground/10">
                      support@occtatele.com
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-sm text-navy-foreground/50 mt-8">
              Got an existing ticket? <Link to="/auth" className="underline hover:text-primary">Log in</Link> to check its status.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Support;
