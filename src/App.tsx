import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

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
import { AdminAuditLog } from "./pages/admin/AuditLog";
import { AdminPaymentRequests } from "./pages/admin/PaymentRequests";
import { AdminCommunications } from "./pages/admin/Communications";
import Broadband from "./pages/Broadband";
import Pay from "./pages/Pay";
import DDSetup from "./pages/DDSetup";
import SimPlans from "./pages/SimPlans";
import Landline from "./pages/Landline";
import Checkout from "./pages/Checkout";
import PreCheckout from "./pages/PreCheckout";
import ThankYou from "./pages/ThankYou";
import Support from "./pages/Support";
import Faq from "./pages/Faq";
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
import PaymentResult from "./pages/PaymentResult";
import BillingSettings from "./pages/BillingSettings";
import NoContractBroadband from "./pages/NoContractBroadband";
import Guides from "./pages/guides/Guides";
import GuidePage from "./pages/guides/GuidePage";
import LocationBroadband from "./pages/LocationBroadband";
import ComparisonPage from "./pages/ComparisonPage";
import KeywordLanding from "./pages/KeywordLanding";

import { locations } from "./data/locations";

const queryClient = new QueryClient();


// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
            <Route path="audit-log" element={<AdminAuditLog />} />
            <Route path="payment-requests" element={<AdminPaymentRequests />} />
            <Route path="communications" element={<AdminCommunications />} />
          </Route>
        </Route>
        <Route path="/broadband" element={<Broadband />} />
        <Route path="/sim-plans" element={<SimPlans />} />
        <Route path="/landline" element={<Landline />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/pre-checkout" element={<PreCheckout />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/support" element={<Support />} />
        <Route path="/faq" element={<Faq />} />
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
        <Route path="/payment-result" element={<PaymentResult />} />
        <Route path="/billing-settings" element={<BillingSettings />} />
        <Route path="/no-contract-broadband-uk" element={<NoContractBroadband />} />
        <Route path="/pay" element={<Pay />} />
        <Route path="/dd/setup" element={<DDSetup />} />
        <Route path="/guides" element={<Guides />} />
        <Route path="/guides/:slug" element={<GuidePage />} />

        {/* Location broadband pages (50 cities) */}
        {locations.map((loc) => (
          <Route key={loc.slug} path={`/broadband-${loc.slug}`} element={<LocationBroadband />} />
        ))}

        {/* Comparison pages */}
        <Route path="/compare/:slug" element={<ComparisonPage />} />

        {/* Keyword landing pages */}
        <Route path="/cheap-broadband-near-me" element={<KeywordLanding />} />
        <Route path="/broadband-no-credit-check" element={<KeywordLanding />} />
        <Route path="/broadband-for-students" element={<KeywordLanding />} />
        <Route path="/best-broadband-deals-uk" element={<KeywordLanding />} />
        <Route path="/broadband-for-gaming" element={<KeywordLanding />} />
        <Route path="/broadband-for-working-from-home" element={<KeywordLanding />} />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
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
