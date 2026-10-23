import { ReactNode, lazy, Suspense, useState, useEffect, useCallback } from "react";
import AppHeader from "./AppHeader";
import AppBottomNav from "./AppBottomNav";
import OfflineIndicator from "./OfflineIndicator";
import { MessageCircle } from "lucide-react";

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
        <button
          onClick={openChat}
          className="fixed right-4 bottom-20 z-[9999] flex items-center gap-2 border-[3px] border-foreground bg-primary px-4 py-2.5 font-display text-sm uppercase text-primary-foreground shadow-[4px_4px_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5"
          aria-label="Open secure OCCTA account chat"
        >
          <MessageCircle className="h-5 w-5" />
          <span>Ask Ollie</span>
        </button>
      )}
    </div>
  );
};

export default AppLayout;
