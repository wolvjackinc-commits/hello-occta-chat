import { Link } from "react-router-dom";
import { ArrowRight, Search, FileText, CreditCard } from "lucide-react";

const HowItWorksStrip = () => {
  const steps = [
    { num: "01", title: "Check availability", desc: "Enter your postcode and build your plan", icon: Search },
    { num: "02", title: "Review your Contract Summary", desc: "We send a clear breakdown before anything is confirmed", icon: FileText },
    { num: "03", title: "Confirm and pay securely", desc: "Only pay when you're ready to go ahead", icon: CreditCard },
  ];

  return (
    <section className="border-y-4 border-primary bg-background">
      <div className="container mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-10" style={{ maxWidth: 1440 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-4">
              <div className="w-10 h-10 border-2 border-foreground flex items-center justify-center flex-shrink-0">
                <step.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-display uppercase text-sm tracking-wider text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-5 border-t-2 border-foreground/10 flex justify-end">
          <Link
            to="/order"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Start your order <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksStrip;