import { Link, useLocation } from "react-router-dom";
import { Bell, Settings } from "lucide-react";
import { motion } from "framer-motion";

const getPageTitle = (pathname: string) => {
  const titles: Record<string, string> = {
    "/": "OCCTA",
    "/broadband": "Broadband",
    "/sim-plans": "SIM Plans",
    "/landline": "Landline",
    "/support": "Support",
    "/dashboard": "My Account",
    "/auth": "Sign In",
    "/checkout": "Checkout",
    "/pre-checkout": "Review Order",
    "/thank-you": "Order Complete",
    "/about": "About Us",
  };
  return titles[pathname] || "OCCTA";
};

const AppHeader = () => {
  const location = useLocation();
  const title = getPageTitle(location.pathname);
  const isHome = location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-background border-b-4 border-foreground safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo / Title */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          key={title}
        >
          {isHome ? (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary border-2 border-foreground flex items-center justify-center">
                <span className="font-display text-sm font-bold text-primary-foreground">O</span>
              </div>
              <span className="font-display text-lg font-bold uppercase tracking-tight">OCCTA</span>
            </Link>
          ) : (
            <h1 className="font-display text-lg font-bold uppercase tracking-tight">{title}</h1>
          )}
        </motion.div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link 
            to="/dashboard" 
            className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <Bell className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
