import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Wifi, Smartphone, PhoneCall, Shield, FileText, Cookie } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-navy text-navy-foreground">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-warning flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-xl">O</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-xl">OCCTA</span>
                <span className="text-xs text-navy-foreground/60">Telecom that gets it</span>
              </div>
            </Link>
            <p className="text-sm text-navy-foreground/70 leading-relaxed">
              Broadband, mobile, and landline services that don't make you want to throw your router out the window. 
              <span className="italic"> (Most of the time.)</span>
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-navy-foreground/70">Ofcom regulated provider</span>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-6">
            <h3 className="font-display font-bold text-lg">Our Services</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/broadband" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <Wifi className="w-4 h-4" />
                  Broadband
                </Link>
              </li>
              <li>
                <Link to="/sim-plans" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <Smartphone className="w-4 h-4" />
                  SIM Plans
                </Link>
              </li>
              <li>
                <Link to="/landline" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <PhoneCall className="w-4 h-4" />
                  Landline
                </Link>
              </li>
              <li>
                <Link to="/bundles" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <span className="w-4 h-4 text-center">📦</span>
                  Bundles
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Legal */}
          <div className="space-y-6">
            <h3 className="font-display font-bold text-lg">Support & Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/support" className="text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  Help Centre
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <Shield className="w-4 h-4" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <FileText className="w-4 h-4" />
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <Cookie className="w-4 h-4" />
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/complaints" className="text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  Complaints Procedure
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-6">
            <h3 className="font-display font-bold text-lg">Get in Touch</h3>
            <ul className="space-y-4">
              <li>
                <a href="tel:08002606627" className="flex items-center gap-3 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <Phone className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium text-navy-foreground">0800 260 6627</div>
                    <div className="text-xs">Free to call, free of jargon</div>
                  </div>
                </a>
              </li>
              <li>
                <a href="mailto:hello@occtatele.com" className="flex items-center gap-3 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium text-navy-foreground">hello@occtatele.com</div>
                    <div className="text-xs">We actually reply!</div>
                  </div>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-sm text-navy-foreground/70">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium text-navy-foreground">OCCTA LIMITED</div>
                    <div className="text-xs">22 Pavilion View<br />Huddersfield HD3 3WU</div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-navy-foreground/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-navy-foreground/60 text-center md:text-left">
              © {currentYear} OCCTA LIMITED. All rights reserved. Company registered in England & Wales.
            </p>
            <p className="text-sm text-navy-foreground/60 text-center md:text-right">
              Made with ☕ and questionable WiFi in Yorkshire
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
