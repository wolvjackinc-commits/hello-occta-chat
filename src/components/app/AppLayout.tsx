import { ReactNode, lazy, Suspense } from "react";
import AppHeader from "./AppHeader";
import AppBottomNav from "./AppBottomNav";
import OfflineIndicator from "./OfflineIndicator";

const AIChatBot = lazy(() => import("@/components/chat/AIChatBot"));

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

const AppLayout = ({ children, hideNav = false }: AppLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OfflineIndicator />
      <AppHeader />
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      {!hideNav && <AppBottomNav />}
      <Suspense fallback={null}>
        <AIChatBot />
      </Suspense>
    </div>
  );
};

export default AppLayout;
