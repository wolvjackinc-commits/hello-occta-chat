import { ReactNode, lazy, Suspense, useState, useEffect, useCallback } from "react";
import AppHeader from "./AppHeader";
import AppBottomNav from "./AppBottomNav";
import OfflineIndicator from "./OfflineIndicator";
import { MessageCircle } from "lucide-react";

const AIChatBot = lazy(() => import("@/components/chat/AIChatBot"));

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
          <AIChatBot />
        </Suspense>
      ) : (
        <button
          onClick={openChat}
          className="fixed right-4 bottom-20 z-[9999] rounded-full bg-primary text-primary-foreground p-3 shadow-lg hover:opacity-90 transition-opacity"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default AppLayout;
