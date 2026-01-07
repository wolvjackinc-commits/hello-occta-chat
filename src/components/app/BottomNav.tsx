import { Link, useLocation } from "react-router-dom";
import { Home, Wifi, Smartphone, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Broadband", path: "/broadband", icon: Wifi },
  { name: "SIM", path: "/sim-plans", icon: Smartphone },
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
];

const BottomNav = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t-4 border-foreground safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-150",
                active 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className={cn("w-6 h-6", active && "scale-110")} />
              <span className={cn(
                "text-xs font-display mt-1 tracking-wide",
                active && "font-bold"
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
