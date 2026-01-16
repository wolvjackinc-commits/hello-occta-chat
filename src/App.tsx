import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { StructuredData } from "@/components/seo";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { ProtectedAdminRoute } from "./components/admin/layout/ProtectedAdminRoute";
import { AdminLayout } from "./components/admin/layout/AdminLayout";
import { AdminOverview } from "./pages/admin/Overview";
import { AdminCustomers } from "./pages/admin/Customers";
import { AdminCustomerDetail } from "./pages/admin/CustomerDetail";
import { AdminOrders } from "./pages/admin/Orders";
import { AdminTickets } from "./pages/admin/Tickets";
import { AdminBilling } from "./pages/admin/Billing";
import { AdminServices } from "./pages/admin/Services";
import { AdminPaymentsDD } from "./pages/admin/PaymentsDD";
import { AdminInstallations } from "./pages/admin/Installations";
import { AdminPlans } from "./pages/admin/Plans";
import { AdminCompliance } from "./pages/admin/Compliance";
import { AdminSettings } from "./pages/admin/Settings";
import Broadband from "./pages/Broadband";
import SimPlans from "./pages/SimPlans";
import Landline from "./pages/Landline";
import Checkout from "./pages/Checkout";
import PreCheckout from "./pages/PreCheckout";
import ThankYou from "./pages/ThankYou";
import Support from "./pages/Support";
import About from "./pages/About";
import Install from "./pages/Install";
import Offline from "./pages/Offline";
import OrderLookup from "./pages/OrderLookup";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import ServiceStatus from "./pages/ServiceStatus";
import Business from "./pages/Business";
import BusinessOffers from "./pages/BusinessOffers";
import BusinessCheckout from "./pages/BusinessCheckout";
import BusinessSales from "./pages/BusinessSales";
import Complaints from "./pages/Complaints";
import PayInvoice from "./pages/PayInvoice";

const queryClient = new QueryClient();

// Brutalist page transitions
const pageVariants = {
  initial: {
    opacity: 0,
    y: 30,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  
  return null;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const isOnline = useOnlineStatus();

  // Show offline page when not connected (except for cached pages)
  if (!isOnline && !navigator.onLine) {
    return <Offline />;
  }

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial="initial"
          animate="enter"
          exit="exit"
          variants={pageVariants}
        >
          <Routes location={location}>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin/*" element={<ProtectedAdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<AdminOverview />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="customers/:accountNumber" element={<AdminCustomerDetail />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="tickets" element={<AdminTickets />} />
                <Route path="billing" element={<AdminBilling />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="payments-dd" element={<AdminPaymentsDD />} />
                <Route path="installations" element={<AdminInstallations />} />
                <Route path="plans" element={<AdminPlans />} />
                <Route path="compliance" element={<AdminCompliance />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Route>
            <Route path="/broadband" element={<Broadband />} />
            <Route path="/sim-plans" element={<SimPlans />} />
            <Route path="/landline" element={<Landline />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/pre-checkout" element={<PreCheckout />} />
            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/support" element={<Support />} />
            <Route path="/about" element={<About />} />
            <Route path="/install" element={<Install />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/status" element={<ServiceStatus />} />
            <Route path="/offline" element={<Offline />} />
            <Route path="/track-order" element={<OrderLookup />} />
            <Route path="/business" element={<Business />} />
            <Route path="/business-offers" element={<BusinessOffers />} />
            <Route path="/business-checkout" element={<BusinessCheckout />} />
            <Route path="/business-sales" element={<BusinessSales />} />
            <Route path="/complaints" element={<Complaints />} />
            <Route path="/pay-invoice" element={<PayInvoice />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <StructuredData type="all" />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
