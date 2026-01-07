import { ReactNode } from "react";
import AppHeader from "./AppHeader";
import AppBottomNav from "./AppBottomNav";
import AIChatBot from "@/components/chat/AIChatBot";

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

const AppLayout = ({ children, hideNav = false }: AppLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      {!hideNav && <AppBottomNav />}
      <AIChatBot />
    </div>
  );
};

export default AppLayout;
