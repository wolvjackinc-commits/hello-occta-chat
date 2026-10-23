import { ReactNode, lazy, Suspense, useState, useEffect, useCallback } from "react";
import AppHeader from "./AppHeader";
import AppBottomNav from "./AppBottomNav";
import OfflineIndicator from "./OfflineIndicator";

import OllieLauncher from "@/components/chat/OllieLauncher";
const OcctaCompanion = lazy(() => import("@/components/chat/OcctaCompanionV4"));

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

const AppLayout = ({ children, hideNav = false }: AppLayoutProps) => {
  const [chatOpen, setChatOpen] = useState(false);

  const openChat = useCallback(() => setChatOpen(true), []);

  useEffect(() => {
    window.addEventListener("open-ai-chat", openChat);
    return () => window.removeEventListener("open-ai-chat", openChat);
  }, [openChat]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OfflineIndicator />
      <AppHeader />
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      {!hideNav && <AppBottomNav />}

      {chatOpen ? (
        <Suspense fallback={null}>
          <OcctaCompanion initialOpen onClose={() => setChatOpen(false)} />
        </Suspense>
      ) : (
        <OllieLauncher onOpen={openChat} bottomClass="bottom-20" />
      )}
    </div>
  );
};

export default AppLayout;
