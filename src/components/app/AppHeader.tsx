import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, MoreHorizontal } from "lucide-react";

const getPageTitle = (pathname: string): string => {
  switch (pathname) {
    case "/":
      return "";
    case "/broadband":
      return "Broadband";
    case "/sim-plans":
      return "SIM Plans";
    case "/landline":
      return "Landline";
    case "/support":
      return "Support";
    case "/dashboard":
      return "Account";
    case "/auth":
      return "Sign In";
    case "/checkout":
      return "Checkout";
    default:
      return "OCCTA";
  }
};

const AppHeader = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const title = getPageTitle(location.pathname);

  // Don't show header on home - it has its own header
  if (isHome) return null;

  return (
    <header className="sticky top-0 z-40 bg-accent safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        <motion.h1
          key={title}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-lg font-semibold text-accent-foreground"
        >
          {title}
        </motion.h1>
        
        <div className="flex items-center gap-2">
          <button 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-accent-foreground" />
          </button>
          <button 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            aria-label="More options"
          >
            <MoreHorizontal className="w-5 h-5 text-accent-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
