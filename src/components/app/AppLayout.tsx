import { ReactNode } from "react";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import AIChatBot from "@/components/chat/AIChatBot";

interface AppLayoutProps {
  children: ReactNode;
  hideBottomNav?: boolean;
}

const AppLayout = ({ children, hideBottomNav = false }: AppLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
      <AIChatBot />
    </div>
  );
};

export default AppLayout;
