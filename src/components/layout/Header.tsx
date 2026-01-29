import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Wifi, Smartphone, PhoneCall, ShieldCheck, User, LogOut, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          checkAdminRole(session.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });
    setIsAdmin(!!data);
  };

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
            30-DAY ROLLING • CANCEL ANYTIME • UK-BASED SUPPORT • FREE INSTALLATION •
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
                    ? "bg-secondary text-foreground border-foreground shadow-brutal -translate-y-0.5"
                    : "border-transparent hover:border-foreground hover:bg-secondary"
                }`}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.name}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`px-4 py-2 font-display text-lg tracking-wide transition-all duration-150 flex items-center gap-2 border-4 ${
                  isActive("/admin")
                    ? "bg-destructive text-destructive-foreground border-foreground shadow-brutal -translate-y-0.5"
                    : "border-transparent hover:border-foreground hover:bg-destructive/10 text-destructive"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </Link>
            )}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <a 
              href={CONTACT_PHONE_TEL} 
              className="flex items-center gap-2 font-display text-lg hover:text-accent transition-colors"
            >
              <div className="p-2 bg-foreground text-background">
                <Phone className="w-4 h-4" />
              </div>
              {CONTACT_PHONE_DISPLAY}
            </a>
            {user ? (
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/track-order">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Search className="w-4 h-4" />
                    Track Order
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" size="sm">Sign In</Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button variant="hero" size="sm">Get Started</Button>
                </Link>
              </>
            )}
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
                      ? "bg-secondary text-foreground border-foreground shadow-brutal"
                      : "border-transparent hover:border-foreground hover:bg-secondary"
                  }`}
                >
                  {item.icon && <item.icon className="w-5 h-5" />}
                  {item.name}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-3 font-display text-xl tracking-wide transition-all duration-150 flex items-center gap-3 border-4 ${
                    isActive("/admin")
                      ? "bg-destructive text-destructive-foreground border-foreground shadow-brutal"
                      : "border-transparent hover:border-foreground hover:bg-destructive/10 text-destructive"
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                  Admin
                </Link>
              )}
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t-4 border-foreground">
                <a href={CONTACT_PHONE_TEL} className="flex items-center gap-3 px-4 py-2 font-display text-lg">
                  <div className="p-2 bg-foreground text-background">
                    <Phone className="w-5 h-5" />
                  </div>
                  {CONTACT_PHONE_DISPLAY}
                </a>
                {user ? (
                  <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" className="w-full gap-2">
                      <User className="w-4 h-4" />
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/track-order" onClick={() => setIsOpen(false)}>
                      <Button variant="ghost" className="w-full gap-2">
                        <Search className="w-4 h-4" />
                        Track Order
                      </Button>
                    </Link>
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full">Sign In</Button>
                    </Link>
                    <Link to="/auth?mode=signup" onClick={() => setIsOpen(false)}>
                      <Button variant="hero" className="w-full">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
