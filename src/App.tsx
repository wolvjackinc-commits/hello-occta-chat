import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { StructuredData } from "@/components/seo";
import { captureReferralFromUrl } from "@/lib/referral";
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
import { AdminChatTranscripts } from "./pages/admin/ChatTranscripts";
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
import FlexBroadband from "./pages/broadband/Flex";
import ContractSaverBroadband from "./pages/broadband/ContractSaver";
import SwitchingPage from "./pages/Switching";
import RewardsPage from "./pages/Rewards";
import BuildPlan from "./pages/BuildPlan";
import QuoteStart from "./pages/quote/QuoteStart";
import QuoteThankYou from "./pages/quote/QuoteThankYou";
import QuoteView from "./pages/quote/QuoteView";
import ContractSummaryView from "./pages/quote/ContractSummaryView";
import QuotePayment from "./pages/quote/QuotePayment";
import { AdminQuoteRequests } from "./pages/admin/QuoteRequests";
import { AdminQuotes } from "./pages/admin/Quotes";
import { AdminVatSettings } from "./pages/admin/VatSettings";
import { AdminSuppliers } from "./pages/admin/Suppliers";
import { AdminPricingRules } from "./pages/admin/PricingRules";
import { AdminMarginRules } from "./pages/admin/MarginRules";
import { AdminRewards } from "./pages/admin/Rewards";
import { AdminReferrals } from "./pages/admin/Referrals";
import { AdminContractBenefits } from "./pages/admin/ContractBenefits";
import { AdminCampaigns } from "./pages/admin/Campaigns";
import { AdminComplaints } from "./pages/admin/Complaints";
import { AdminKnowledgeBase } from "./pages/admin/KnowledgeBase";
import { AdminFairPricing } from "./pages/admin/FairPricing";
import AcceptableUse from "./pages/legal/AcceptableUse";
import ComplaintsCode from "./pages/legal/ComplaintsCode";
import VulnerableCustomers from "./pages/legal/VulnerableCustomers";
import Accessibility from "./pages/legal/Accessibility";
import ModernSlavery from "./pages/legal/ModernSlavery";
import CodeOfPractice from "./pages/legal/CodeOfPractice";
import PriceTransparency from "./pages/legal/PriceTransparency";
import SwitchingPolicy from "./pages/legal/SwitchingPolicy";
import NetworkManagement from "./pages/legal/NetworkManagement";

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

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

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
            <Route path="chat-transcripts" element={<AdminChatTranscripts />} />
            <Route path="quote-requests" element={<AdminQuoteRequests />} />
            <Route path="quotes" element={<AdminQuotes />} />
            <Route path="vat-settings" element={<AdminVatSettings />} />
            <Route path="suppliers" element={<AdminSuppliers />} />
            <Route path="pricing-rules" element={<AdminPricingRules />} />
            <Route path="margin-rules" element={<AdminMarginRules />} />
            <Route path="rewards" element={<AdminRewards />} />
            <Route path="referrals" element={<AdminReferrals />} />
            <Route path="contract-benefits" element={<AdminContractBenefits />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="complaints" element={<AdminComplaints />} />
            <Route path="knowledge-base" element={<AdminKnowledgeBase />} />
            <Route path="fair-pricing" element={<AdminFairPricing />} />
          </Route>
        </Route>
        <Route path="/broadband" element={<Broadband />} />
        <Route path="/build-plan" element={<BuildPlan />} />
        <Route path="/broadband/flex" element={<FlexBroadband />} />
        <Route path="/broadband/contract-saver" element={<ContractSaverBroadband />} />
        <Route path="/switching" element={<SwitchingPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/quote/start" element={<QuoteStart />} />
        <Route path="/quote/thank-you" element={<QuoteThankYou />} />
        <Route path="/quote/contract-summary/:token" element={<ContractSummaryView />} />
        <Route path="/quote/payment/:token" element={<QuotePayment />} />
        <Route path="/quote/:token" element={<QuoteView />} />
        <Route path="/legal/acceptable-use" element={<AcceptableUse />} />
        <Route path="/legal/complaints-code" element={<ComplaintsCode />} />
        <Route path="/legal/vulnerable-customers" element={<VulnerableCustomers />} />
        <Route path="/legal/accessibility" element={<Accessibility />} />
        <Route path="/legal/modern-slavery" element={<ModernSlavery />} />
        <Route path="/legal/code-of-practice" element={<CodeOfPractice />} />
        <Route path="/legal/price-transparency" element={<PriceTransparency />} />
        <Route path="/legal/switching-policy" element={<SwitchingPolicy />} />
        <Route path="/legal/network-management" element={<NetworkManagement />} />
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
