import { ReactNode, lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "./Header";
import { MessageCircle, Phone, ShieldCheck } from "lucide-react";
import CheckoutJourneyTracker from "@/components/checkout/CheckoutJourneyTracker";
import Switch50CampaignStrip from "@/components/campaigns/Switch50CampaignStrip";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";

const Footer = lazy(() => import("./Footer"));
const OcctaCompanion = lazy(() => import("@/components/chat/OcctaCompanionV4"));

interface LayoutProps {
  children: ReactNode;
}

function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-4 border-foreground bg-background">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:h-20 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2" aria-label="OCCTA home">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border-4 border-foreground bg-primary shadow-[3px_3px_0_0_hsl(var(--foreground))] sm:h-12 sm:w-12">
            <span className="font-display text-xl text-primary-foreground sm:text-2xl">O</span>
          </div>
          <div className="min-w-0">
            <span className="block font-display text-2xl leading-none tracking-tight sm:text-3xl">OCCTA</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Secure online order
            </span>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground sm:flex">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Secure order</span>
          </div>
          <a
            href={CONTACT_PHONE_TEL}
            className="inline-flex min-h-10 items-center gap-2 border-2 border-foreground px-3 font-display text-sm uppercase sm:min-h-11 sm:px-4 sm:text-base"
            aria-label={`Call OCCTA on ${CONTACT_PHONE_DISPLAY}`}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{CONTACT_PHONE_DISPLAY}</span>
            <span className="sm:hidden">Help</span>
          </a>
        </div>
      </div>
    </header>
  );
}

const Layout = ({ children }: LayoutProps) => {
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();
  const isCheckout = location.pathname === "/order" || location.pathname.startsWith("/order/");

  const openChat = useCallback(() => setChatOpen(true), []);

  useEffect(() => {
    window.addEventListener("open-ai-chat", openChat);
    return () => window.removeEventListener("open-ai-chat", openChat);
  }, [openChat]);

  return (
    <div className="min-h-screen flex flex-col">
      <CheckoutJourneyTracker />
      {isCheckout ? <CheckoutHeader /> : <Header />}
      {!isCheckout && <Switch50CampaignStrip />}
      <main className="flex-1">{children}</main>
      {!isCheckout && (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      )}

      {chatOpen ? (
        <Suspense fallback={null}>
          <OcctaCompanion initialOpen onClose={() => setChatOpen(false)} />
        </Suspense>
      ) : !isCheckout ? (
        <button
          onClick={openChat}
          className="fixed right-4 bottom-4 z-[9999] rounded-full bg-primary text-primary-foreground p-3 shadow-lg hover:opacity-90 transition-opacity"
          aria-label="Open OCCTA chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : null}
    </div>
  );
};

export default Layout;
