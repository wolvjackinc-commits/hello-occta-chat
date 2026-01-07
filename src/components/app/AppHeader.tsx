import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, Menu, X, ShieldCheck, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

const AppHeader = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
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

  // Get page title from pathname
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/") return "Home";
    if (path === "/broadband") return "Broadband";
    if (path === "/sim-plans") return "SIM Plans";
    if (path === "/landline") return "Landline";
    if (path === "/dashboard") return "Dashboard";
    if (path === "/support") return "Support";
    if (path === "/about") return "About";
    if (path === "/admin") return "Admin";
    if (path === "/auth") return "Sign In";
    if (path === "/checkout") return "Checkout";
    if (path === "/pre-checkout") return "Review Order";
    return "OCCTA";
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-background border-b-4 border-foreground safe-area-top">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Logo/Brand */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary border-3 border-foreground shadow-brutal flex items-center justify-center">
              <span className="font-display text-lg text-primary-foreground">O</span>
            </div>
          </Link>

          {/* Page Title */}
          <h1 className="font-display text-xl tracking-wide">{getPageTitle()}</h1>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <Link 
                to="/dashboard"
                className={cn(
                  "p-2 border-2 border-foreground transition-all",
                  location.pathname === "/dashboard" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-background hover:bg-secondary"
                )}
              >
                <User className="w-5 h-5" />
              </Link>
            ) : (
              <Link 
                to="/auth"
                className="p-2 border-2 border-foreground bg-background hover:bg-secondary transition-all"
              >
                <User className="w-5 h-5" />
              </Link>
            )}
            
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 border-2 border-foreground bg-background hover:bg-secondary transition-all"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 pt-14 safe-area-top">
          <div 
            className="absolute inset-0 bg-foreground/50" 
            onClick={() => setIsMenuOpen(false)} 
          />
          <div className="absolute top-14 right-0 w-64 h-[calc(100vh-3.5rem)] bg-background border-l-4 border-foreground animate-slide-in-right overflow-y-auto">
            <nav className="p-4 space-y-2">
              <Link 
                to="/landline" 
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 font-display text-lg border-2 border-foreground hover:bg-secondary transition-all"
              >
                Landline
              </Link>
              <Link 
                to="/about" 
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 font-display text-lg border-2 border-foreground hover:bg-secondary transition-all"
              >
                About
              </Link>
              <Link 
                to="/support" 
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 font-display text-lg border-2 border-foreground hover:bg-secondary transition-all"
              >
                Support
              </Link>
              
              {isAdmin && (
                <Link 
                  to="/admin" 
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 font-display text-lg border-2 border-destructive text-destructive hover:bg-destructive/10 transition-all"
                >
                  <ShieldCheck className="w-5 h-5 inline mr-2" />
                  Admin
                </Link>
              )}

              <hr className="my-4 border-2 border-foreground" />

              <a 
                href="tel:08002606627" 
                className="flex items-center gap-3 px-4 py-3 font-display text-lg border-2 border-foreground hover:bg-secondary transition-all"
              >
                <Phone className="w-5 h-5" />
                0800 260 6627
              </a>

              {!user && (
                <Link 
                  to="/auth" 
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 font-display text-lg text-center bg-primary text-primary-foreground border-2 border-foreground shadow-brutal hover:-translate-y-0.5 transition-all"
                >
                  Get Started
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};

export default AppHeader;
