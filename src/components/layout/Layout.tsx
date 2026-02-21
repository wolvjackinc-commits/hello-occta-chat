import { ReactNode, lazy, Suspense } from "react";
import Header from "./Header";

const Footer = lazy(() => import("./Footer"));
const AIChatBot = lazy(() => import("@/components/chat/AIChatBot"));

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <Footer />
        <AIChatBot />
      </Suspense>
    </div>
  );
};

export default Layout;
