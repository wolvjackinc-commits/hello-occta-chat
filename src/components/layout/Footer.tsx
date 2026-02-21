import { Link } from "react-router-dom";
import { Phone, Mail, Bot, LayoutDashboard, Ticket, Shield } from "lucide-react";
import { companyConfig } from "@/lib/companyConfig";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    services: [
      { name: "Broadband", path: "/broadband" },
      { name: "SIM Plans", path: "/sim-plans" },
      { name: "Landline", path: "/landline" },
      { name: "Business", path: "/business" },
    ],
    support: [
      { name: "Help & Support Hub", path: "/support" },
      { name: "AI Assistant", path: "/support#ai-help" },
      { name: "My Dashboard", path: "/dashboard" },
      { name: "Service Status", path: "/status" },
    ],
    legal: [
      { name: "Privacy Policy", path: "/privacy" },
      { name: "Terms of Service", path: "/terms" },
      { name: "Cookie Policy", path: "/cookies" },
      { name: "Complaints", path: "/complaints" },
    ],
  };

  return (
    <footer className="bg-foreground text-background border-t-4 border-primary">
      {/* Self-Service Support Banner */}
      <div className="bg-primary/10 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <span className="text-primary font-medium">Need help?</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link to="/support" className="flex items-center gap-1 text-background/80 hover:text-primary transition-colors">
                <Bot className="w-4 h-4" />
                Get instant help with our AI assistant
              </Link>
              <span className="hidden sm:inline text-background/40">•</span>
              <Link to="/dashboard" className="flex items-center gap-1 text-background/80 hover:text-primary transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                Manage your account
              </Link>
              <span className="hidden sm:inline text-background/40">•</span>
              <Link to="/support#tickets" className="flex items-center gap-1 text-background/80 hover:text-primary transition-colors">
                <Ticket className="w-4 h-4" />
                Raise a ticket
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-primary border-4 border-primary flex items-center justify-center">
                <span className="font-display text-2xl text-primary-foreground">O</span>
              </div>
              <div>
                <span className="font-display text-3xl">OCCTA</span>
                <p className="text-xs text-background/70 uppercase tracking-widest">Limited</p>
              </div>
            </Link>
            <p className="text-background/80 mb-6 max-w-xs">
              Proper British telecom. No robots, no rubbish, no regrets.
            </p>
            
            {/* Contact Info - De-emphasised phone */}
            <div className="space-y-3">
              <Link to="/support" className="flex items-center gap-3 text-background/80 hover:text-primary transition-colors">
                <div className="p-2 bg-primary/20">
                  <Bot className="w-4 h-4" />
                </div>
                <span className="font-display">Get Instant Help</span>
              </Link>
              <a href={`mailto:${companyConfig.email.general}`} className="flex items-center gap-3 text-background/80 hover:text-primary transition-colors">
                <div className="p-2 bg-primary/20">
                  <Mail className="w-4 h-4" />
                </div>
                <span>{companyConfig.email.general}</span>
              </a>
              <div className="flex items-center gap-3 text-background/60 text-sm">
                <div className="p-2 bg-background/10">
                  <Phone className="w-4 h-4" />
                </div>
                <span>{companyConfig.phone.display} (escalation only)</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display text-xl mb-6 text-primary">SERVICES</h4>
            <ul className="space-y-3">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.path} 
                    className="text-background/80 hover:text-primary transition-colors font-medium"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-display text-xl mb-6 text-primary">SUPPORT</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.path} 
                    className="text-background/80 hover:text-primary transition-colors font-medium"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display text-xl mb-6 text-primary">LEGAL</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.path} 
                    className="text-background/80 hover:text-primary transition-colors font-medium"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t-4 border-primary/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-background/70 text-sm">
              © {currentYear} {companyConfig.name}. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-background/70">
              <span>Company No. {companyConfig.companyNumber}</span>
              <span>•</span>
              <span>UK Registered</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-background/60 text-center md:text-left">
            Registered address: {companyConfig.address.full}.
          </div>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-background/60">
            <Shield className="w-4 h-4" />
            <p>
              {companyConfig.compliance} Self-service support ensures faster resolution and data protection.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
