import { ReactNode, lazy, Suspense, useState, useEffect, useCallback } from "react";
import Header from "./Header";
import { MessageCircle } from "lucide-react";

const Footer = lazy(() => import("./Footer"));
const AIChatBot = lazy(() => import("@/components/chat/AIChatBot"));

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [chatOpen, setChatOpen] = useState(false);

  const openChat = useCallback(() => setChatOpen(true), []);

  useEffect(() => {
    window.addEventListener("open-ai-chat", openChat);
    return () => window.removeEventListener("open-ai-chat", openChat);
  }, [openChat]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>

      {chatOpen ? (
        <Suspense fallback={null}>
          <AIChatBot />
        </Suspense>
      ) : (
        <button
          onClick={openChat}
          className="fixed right-4 bottom-4 z-[9999] rounded-full bg-primary text-primary-foreground p-3 shadow-lg hover:opacity-90 transition-opacity"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default Layout;
