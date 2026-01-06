import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Wifi, Smartphone, PhoneCall } from "lucide-react";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: "Broadband", path: "/broadband", icon: Wifi },
    { name: "SIM Plans", path: "/sim-plans", icon: Smartphone },
    { name: "Landline", path: "/landline", icon: PhoneCall },
    { name: "About", path: "/about" },
    { name: "Support", path: "/support" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-background border-b-4 border-foreground">
      {/* Announcement Bar */}
      <div className="bg-foreground text-background overflow-hidden">
        <div className="py-2 flex whitespace-nowrap">
          <span className="marquee font-display tracking-wider text-sm">
            🇬🇧 PROPER BRITISH BROADBAND • NO ROBOT SUPPORT LINES • ACTUAL HUMANS IN HUDDERSFIELD • FREE INSTALLATION • 30-DAY CONTRACTS • 
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-4 group">
            <div className="relative">
              <div className="w-14 h-14 bg-primary border-4 border-foreground shadow-brutal flex items-center justify-center group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 group-hover:shadow-brutal-lg transition-all duration-150">
                <span className="font-display text-2xl text-primary-foreground">O</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-3xl tracking-tight">OCCTA</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Telecom That Gets It
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`px-4 py-2 font-display text-lg tracking-wide transition-all duration-150 flex items-center gap-2 border-4 ${
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground border-foreground shadow-brutal -translate-y-0.5"
                    : "border-transparent hover:border-foreground hover:bg-secondary"
                }`}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.name}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <a 
              href="tel:08002606627" 
              className="flex items-center gap-2 font-display text-lg hover:text-accent transition-colors"
            >
              <div className="p-2 bg-foreground text-background">
                <Phone className="w-4 h-4" />
              </div>
              0800 260 6627
            </a>
            <Link to="/auth">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button variant="hero" size="sm">Get Started</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-3 border-4 border-foreground bg-background hover:bg-secondary transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden py-4 border-t-4 border-foreground animate-slide-up">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-3 font-display text-xl tracking-wide transition-all duration-150 flex items-center gap-3 border-4 ${
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground border-foreground shadow-brutal"
                      : "border-transparent hover:border-foreground hover:bg-secondary"
                  }`}
                >
                  {item.icon && <item.icon className="w-5 h-5" />}
                  {item.name}
                </Link>
              ))}
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t-4 border-foreground">
                <a href="tel:08002606627" className="flex items-center gap-3 px-4 py-2 font-display text-lg">
                  <div className="p-2 bg-foreground text-background">
                    <Phone className="w-5 h-5" />
                  </div>
                  0800 260 6627
                </a>
                <Link to="/auth" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Link to="/auth?mode=signup" onClick={() => setIsOpen(false)}>
                  <Button variant="hero" className="w-full">Get Started</Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
