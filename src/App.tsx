import { useEffect, lazy, Suspense } from "react";
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
// Admin pages are lazy-loaded — they ship as separate chunks and are only
// fetched when staff actually navigate into /admin/*. This keeps them out
// of the initial customer bundle.
const AdminOverview = lazy(() => import("./pages/admin/Overview").then(m => ({ default: m.AdminOverview })));
const AdminCustomers = lazy(() => import("./pages/admin/Customers").then(m => ({ default: m.AdminCustomers })));
const AdminCustomerDetail = lazy(() => import("./pages/admin/CustomerDetail").then(m => ({ default: m.AdminCustomerDetail })));
const AdminOrders = lazy(() => import("./pages/admin/Orders").then(m => ({ default: m.AdminOrders })));
const AdminTickets = lazy(() => import("./pages/admin/Tickets").then(m => ({ default: m.AdminTickets })));
const AdminBilling = lazy(() => import("./pages/admin/Billing").then(m => ({ default: m.AdminBilling })));
const AdminServices = lazy(() => import("./pages/admin/Services").then(m => ({ default: m.AdminServices })));
const AdminPaymentsDD = lazy(() => import("./pages/admin/PaymentsDD").then(m => ({ default: m.AdminPaymentsDD })));
const AdminInstallations = lazy(() => import("./pages/admin/Installations").then(m => ({ default: m.AdminInstallations })));
const AdminPlans = lazy(() => import("./pages/admin/Plans").then(m => ({ default: m.AdminPlans })));
const AdminCompliance = lazy(() => import("./pages/admin/Compliance").then(m => ({ default: m.AdminCompliance })));
const AdminSettings = lazy(() => import("./pages/admin/Settings").then(m => ({ default: m.AdminSettings })));
const AdminAuditLog = lazy(() => import("./pages/admin/AuditLog").then(m => ({ default: m.AdminAuditLog })));
const AdminPaymentRequests = lazy(() => import("./pages/admin/PaymentRequests").then(m => ({ default: m.AdminPaymentRequests })));
const AdminCommunications = lazy(() => import("./pages/admin/Communications").then(m => ({ default: m.AdminCommunications })));
const AdminChatTranscripts = lazy(() => import("./pages/admin/ChatTranscripts").then(m => ({ default: m.AdminChatTranscripts })));
import Broadband from "./pages/Broadband";
import Pay from "./pages/Pay";
import PayInternalReturn from "./pages/PayInternalReturn";
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
import UnifiedJourney from "./pages/quote/UnifiedJourney";
import ContractSummaryView from "./pages/quote/ContractSummaryView";
import QuotePayment from "./pages/quote/QuotePayment";
import ContractSummaryAuthedView from "./pages/dashboard/ContractSummaryAuthedView";
import ReceiptView from "./pages/ReceiptView";
const AdminQuoteRequests = lazy(() => import("./pages/admin/QuoteRequests").then(m => ({ default: m.AdminQuoteRequests })));
const AdminQuotes = lazy(() => import("./pages/admin/Quotes").then(m => ({ default: m.AdminQuotes })));
const AdminVatSettings = lazy(() => import("./pages/admin/VatSettings").then(m => ({ default: m.AdminVatSettings })));
const AdminSuppliers = lazy(() => import("./pages/admin/Suppliers").then(m => ({ default: m.AdminSuppliers })));
const AdminPricingRules = lazy(() => import("./pages/admin/PricingRules").then(m => ({ default: m.AdminPricingRules })));
const AdminMarginRules = lazy(() => import("./pages/admin/MarginRules").then(m => ({ default: m.AdminMarginRules })));
const AdminRewards = lazy(() => import("./pages/admin/Rewards").then(m => ({ default: m.AdminRewards })));
const AdminReferrals = lazy(() => import("./pages/admin/Referrals").then(m => ({ default: m.AdminReferrals })));
const AdminContractBenefits = lazy(() => import("./pages/admin/ContractBenefits").then(m => ({ default: m.AdminContractBenefits })));
const AdminCampaigns = lazy(() => import("./pages/admin/Campaigns").then(m => ({ default: m.AdminCampaigns })));
const AdminComplaints = lazy(() => import("./pages/admin/Complaints").then(m => ({ default: m.AdminComplaints })));
const AdminKnowledgeBase = lazy(() => import("./pages/admin/KnowledgeBase").then(m => ({ default: m.AdminKnowledgeBase })));
const AdminFairPricing = lazy(() => import("./pages/admin/FairPricing").then(m => ({ default: m.AdminFairPricing })));
const AdminSuppliersGiacomImport = lazy(() => import("./pages/admin/SuppliersGiacomImport").then(m => ({ default: m.AdminSuppliersGiacomImport })));
const AdminReadiness = lazy(() => import("./pages/admin/Readiness").then(m => ({ default: m.AdminReadiness })));
const AdminLaunchSafety = lazy(() => import("./pages/admin/LaunchSafety"));
const AdminCustomerJourney = lazy(() => import("./pages/admin/CustomerJourney"));
const AdminTasks = lazy(() => import("./pages/admin/Tasks"));
const AdminManualFulfilment = lazy(() => import("./pages/admin/ManualFulfilment"));
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

const AdminRouteFallback = () => (
  <div className="p-8 flex items-center justify-center">
    <div className="p-4 border-4 border-foreground bg-background animate-pulse text-sm font-display uppercase">Loading…</div>
  </div>
);

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
            <Route path="overview" element={<Suspense fallback={<AdminRouteFallback />}><AdminOverview /></Suspense>} />
            <Route path="customers" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomers /></Suspense>} />
            <Route path="customers/:accountNumber" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomerDetail /></Suspense>} />
            <Route path="customers/:accountNumber/journey" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomerJourney /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<AdminRouteFallback />}><AdminOrders /></Suspense>} />
            <Route path="tickets" element={<Suspense fallback={<AdminRouteFallback />}><AdminTickets /></Suspense>} />
            <Route path="billing" element={<Suspense fallback={<AdminRouteFallback />}><AdminBilling /></Suspense>} />
            <Route path="services" element={<Suspense fallback={<AdminRouteFallback />}><AdminServices /></Suspense>} />
            <Route path="payments-dd" element={<Suspense fallback={<AdminRouteFallback />}><AdminPaymentsDD /></Suspense>} />
            <Route path="installations" element={<Suspense fallback={<AdminRouteFallback />}><AdminInstallations /></Suspense>} />
            <Route path="plans" element={<Suspense fallback={<AdminRouteFallback />}><AdminPlans /></Suspense>} />
            <Route path="compliance" element={<Suspense fallback={<AdminRouteFallback />}><AdminCompliance /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<AdminRouteFallback />}><AdminSettings /></Suspense>} />
            <Route path="audit-log" element={<Suspense fallback={<AdminRouteFallback />}><AdminAuditLog /></Suspense>} />
            <Route path="payment-requests" element={<Suspense fallback={<AdminRouteFallback />}><AdminPaymentRequests /></Suspense>} />
            <Route path="communications" element={<Suspense fallback={<AdminRouteFallback />}><AdminCommunications /></Suspense>} />
            <Route path="chat-transcripts" element={<Suspense fallback={<AdminRouteFallback />}><AdminChatTranscripts /></Suspense>} />
            <Route path="quote-requests" element={<Suspense fallback={<AdminRouteFallback />}><AdminQuoteRequests /></Suspense>} />
            <Route path="quotes" element={<Suspense fallback={<AdminRouteFallback />}><AdminQuotes /></Suspense>} />
            <Route path="vat-settings" element={<Suspense fallback={<AdminRouteFallback />}><AdminVatSettings /></Suspense>} />
            <Route path="suppliers" element={<Suspense fallback={<AdminRouteFallback />}><AdminSuppliers /></Suspense>} />
            <Route path="pricing-rules" element={<Suspense fallback={<AdminRouteFallback />}><AdminPricingRules /></Suspense>} />
            <Route path="margin-rules" element={<Suspense fallback={<AdminRouteFallback />}><AdminMarginRules /></Suspense>} />
            <Route path="rewards" element={<Suspense fallback={<AdminRouteFallback />}><AdminRewards /></Suspense>} />
            <Route path="referrals" element={<Suspense fallback={<AdminRouteFallback />}><AdminReferrals /></Suspense>} />
            <Route path="contract-benefits" element={<Suspense fallback={<AdminRouteFallback />}><AdminContractBenefits /></Suspense>} />
            <Route path="campaigns" element={<Suspense fallback={<AdminRouteFallback />}><AdminCampaigns /></Suspense>} />
            <Route path="complaints" element={<Suspense fallback={<AdminRouteFallback />}><AdminComplaints /></Suspense>} />
            <Route path="knowledge-base" element={<Suspense fallback={<AdminRouteFallback />}><AdminKnowledgeBase /></Suspense>} />
            <Route path="fair-pricing" element={<Suspense fallback={<AdminRouteFallback />}><AdminFairPricing /></Suspense>} />
            <Route path="suppliers/giacom-import" element={<Suspense fallback={<AdminRouteFallback />}><AdminSuppliersGiacomImport /></Suspense>} />
            <Route path="readiness" element={<Suspense fallback={<AdminRouteFallback />}><AdminReadiness /></Suspense>} />
            <Route path="launch-safety" element={<Suspense fallback={<AdminRouteFallback />}><AdminLaunchSafety /></Suspense>} />
            <Route path="tasks" element={<Suspense fallback={<AdminRouteFallback />}><AdminTasks /></Suspense>} />
            <Route path="manual-fulfilment" element={<Suspense fallback={<AdminRouteFallback />}><AdminManualFulfilment /></Suspense>} />
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
        <Route path="/dashboard/contract/:csId" element={<ContractSummaryAuthedView />} />
        <Route path="/dashboard/receipt/:id" element={<ReceiptView mode="auth" />} />
        <Route path="/receipt/:token" element={<ReceiptView mode="token" />} />
        <Route path="/quote/payment/:token" element={<QuotePayment />} />
        <Route path="/quote/:token" element={<UnifiedJourney />} />
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
        <Route path="/pay/_internal" element={<PayInternalReturn />} />
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
