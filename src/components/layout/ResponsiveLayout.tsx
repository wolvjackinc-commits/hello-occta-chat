import { ReactNode } from "react";
import { usePWA } from "@/hooks/usePWA";
import Layout from "./Layout";
import AppLayout from "@/components/app/AppLayout";

interface ResponsiveLayoutProps {
  children: ReactNode;
  hideBottomNav?: boolean;
}

/**
 * Automatically chooses between web layout and app layout
 * based on whether the app is running as an installed PWA
 */
const ResponsiveLayout = ({ children, hideBottomNav }: ResponsiveLayoutProps) => {
  const { isStandalone } = usePWA();

  if (isStandalone) {
    return <AppLayout hideBottomNav={hideBottomNav}>{children}</AppLayout>;
  }

  return <Layout>{children}</Layout>;
};

export default ResponsiveLayout;
