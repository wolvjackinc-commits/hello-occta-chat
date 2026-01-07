import { Link, useLocation } from "react-router-dom";
import { Home, Wifi, Smartphone, User, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Wifi, label: "Broadband", path: "/broadband" },
  { icon: Smartphone, label: "SIM", path: "/sim-plans" },
  { icon: HelpCircle, label: "Support", path: "/support" },
  { icon: User, label: "Account", path: "/dashboard" },
];

const AppBottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom shadow-lg">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 h-full relative py-2"
            >
              <motion.div
                className={`flex flex-col items-center justify-center ${isActive ? 'text-accent' : 'text-muted-foreground'}`}
                whileTap={{ scale: 0.9 }}
              >
                <div className={`p-1.5 rounded-xl ${isActive ? 'bg-accent/10' : ''}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                  {item.label}
                </span>
              </motion.div>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default AppBottomNav;
