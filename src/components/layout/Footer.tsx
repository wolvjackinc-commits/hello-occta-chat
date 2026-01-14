import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

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
      { name: "Help Centre", path: "/support" },
      { name: "Contact Us", path: "/support#contact" },
      { name: "Service Status", path: "/status" },
      { name: "FAQs", path: "/support#faqs" },
    ],
    legal: [
      { name: "Privacy Policy", path: "/privacy-policy" },
      { name: "Terms of Service", path: "/terms" },
      { name: "Cookie Policy", path: "/cookies" },
      { name: "Complaints", path: "/complaints" },
    ],
  };

  return (
    <footer className="bg-foreground text-background border-t-4 border-primary">
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
            
            {/* Contact Info */}
            <div className="space-y-3">
              <a href="tel:08002606627" className="flex items-center gap-3 text-background/80 hover:text-primary transition-colors">
                <div className="p-2 bg-primary/20">
                  <Phone className="w-4 h-4" />
                </div>
                <span className="font-display">0800 260 6627</span>
              </a>
              <a href="mailto:hello@occtatele.com" className="flex items-center gap-3 text-background/80 hover:text-primary transition-colors">
                <div className="p-2 bg-primary/20">
                  <Mail className="w-4 h-4" />
                </div>
                <span>hello@occtatele.com</span>
              </a>
              <div className="flex items-start gap-3 text-background/80">
                <div className="p-2 bg-primary/20">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-sm">
                  22 Pavilion View<br />
                  Huddersfield<br />
                  HD3 3WU
                </span>
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
              © {currentYear} OCCTA Limited. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-background/70">
              <span>Company No. 13828933</span>
              <span>•</span>
              <span>UK Registered</span>
            </div>
          </div>
          <p className="text-center text-xs text-background/60 mt-4">
            OCCTA Limited complies with all UK telecommunications regulations and GDPR requirements. 98% of our customers recommend us.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
