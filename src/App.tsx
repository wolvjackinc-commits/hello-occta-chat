import { useEffect, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { StructuredData } from "@/components/seo";
import { CookieConsent } from "@/components/legal/CookieConsent";
import PrivateRouteNoIndex from "@/components/seo/PrivateRouteNoIndex";
import { captureReferralFromUrl } from "@/lib/referral";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
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
const AdminBillingReconciliation = lazy(() => import("./pages/admin/BillingReconciliation").then(m => ({ default: m.AdminBillingReconciliation })));
const AdminBillingChainCheck = lazy(() => import("./pages/admin/BillingChainCheck").then(m => ({ default: m.AdminBillingChainCheck })));
const AdminLegacyRemediation = lazy(() => import("./pages/admin/LegacyRemediation").then(m => ({ default: m.AdminLegacyRemediation })));
const AdminAbhayRemediation = lazy(() => import("./pages/admin/AbhayRemediation").then(m => ({ default: m.AdminAbhayRemediation })));
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
const AdminLiveChat = lazy(() => import("./pages/admin/LiveChat"));
const AdminWebhookMonitor = lazy(() => import("./pages/admin/WebhookMonitor"));
const AdminNotificationSettings = lazy(() => import("./pages/admin/NotificationSettings"));
const AdminNotificationEvents = lazy(() => import("./pages/admin/NotificationEvents"));
import Broadband from "./pages/Broadband";
import Pay from "./pages/Pay";
import PayInternalReturn from "./pages/PayInternalReturn";
import DDSetup from "./pages/DDSetup";
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
import HelpCenter from "./pages/help/HelpCenter";
import HelpArticlePage from "./pages/help/HelpArticle";
import OwnRouterSetup from "./pages/help/OwnRouterSetup";
// DB-backed knowledge-base pages (loaded lazily — public site)
const DbHelpArticle = lazy(() => import("./pages/kb/DbHelpArticle"));
const DbGuidePage = lazy(() => import("./pages/kb/DbGuidePage"));
const BlogIndex = lazy(() => import("./pages/kb/BlogIndex"));
const BlogPost = lazy(() => import("./pages/kb/BlogPost"));
const LearnHub = lazy(() => import("./pages/learn/LearnHub"));
const LearnPage = lazy(() => import("./pages/learn/LearnPage"));
const CoverageAreas = lazy(() => import("./pages/CoverageAreas"));
const RoutersPage = lazy(() => import("./pages/seo/Routers"));
const BroadbandPlansSeo = lazy(() => import("./pages/seo/BroadbandPlans"));
const SimOnlyPlansSeo = lazy(() => import("./pages/seo/SimOnlyPlans"));
const SwitchBroadbandSeo = lazy(() => import("./pages/seo/SwitchBroadband"));
const LandlinePlansSeo = lazy(() => import("./pages/seo/LandlinePlans"));
import LocationBroadband from "./pages/LocationBroadband";
import ComparisonPage from "./pages/ComparisonPage";
import NoContractBroadbandComparison from "./pages/NoContractBroadbandComparison";
import RollingVsFixedBroadbandComparison from "./pages/RollingVsFixedBroadbandComparison";
import KeywordLanding from "./pages/KeywordLanding";
// SEO content pages
import PricingPage from "./pages/seo/Pricing";
import CoveragePage from "./pages/seo/Coverage";
import FibreBroadbandPage from "./pages/seo/FibreBroadband";
import BroadbandAndDigitalVoicePage from "./pages/seo/BroadbandAndDigitalVoice";
import SmallBusinessTelecomPage from "./pages/seo/SmallBusinessTelecom";
import BillingExplainedPage from "./pages/seo/BillingExplained";
import FirstInvoiceExplainedPage from "./pages/seo/FirstInvoiceExplained";
import DirectDebitSetupPage from "./pages/seo/DirectDebitSetup";
import PayByCardPage from "./pages/seo/PayByCard";
import CancellationPage from "./pages/seo/Cancellation";
import ContactPage from "./pages/seo/Contact";
import VulnerableCustomersPublicPage from "./pages/seo/VulnerableCustomers";
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
const TwoDocAcceptance = lazy(() => import("./pages/quote/TwoDocAcceptance"));
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
const AdminBlogEditor = lazy(() => import("./pages/admin/BlogEditor").then(m => ({ default: m.AdminBlogEditor })));
const AdminFairPricing = lazy(() => import("./pages/admin/FairPricing").then(m => ({ default: m.AdminFairPricing })));
const AdminSuppliersGiacomImport = lazy(() => import("./pages/admin/SuppliersGiacomImport").then(m => ({ default: m.AdminSuppliersGiacomImport })));
const AdminCustomerJourney = lazy(() => import("./pages/admin/CustomerJourney"));
const AdminSimPlans = lazy(() => import("./pages/admin/SimPlansAdmin").then(m => ({ default: m.AdminSimPlans })));
const AdminSimOrders = lazy(() => import("./pages/admin/SimOrders").then(m => ({ default: m.AdminSimOrders })));
const AdminBusinessLeads = lazy(() => import("./pages/admin/BusinessLeads"));
const AdminBusinessQuoteRequests = lazy(() => import("./pages/admin/BusinessQuoteRequests"));
const AdminBusinessActivityLog = lazy(() => import("./pages/admin/BusinessActivityLog"));
const AdminRolesPermissions = lazy(() => import("./pages/admin/RolesPermissions"));
// New business hub (replaces legacy /business page)
const BusinessHub = lazy(() => import("./pages/business/BusinessHub"));
const BusinessBroadbandPage = lazy(() => import("./pages/business/BusinessBroadband"));
const BusinessVoicePage = lazy(() => import("./pages/business/BusinessVoice"));
const BusinessSimPage = lazy(() => import("./pages/business/BusinessSim"));
const BusinessBundlesPage = lazy(() => import("./pages/business/BusinessBundles"));
const BusinessIndustryPage = lazy(() => import("./pages/business/BusinessIndustry"));
const BusinessContactSalesPage = lazy(() => import("./pages/business/BusinessContactSales"));
const BusinessSupportPage = lazy(() => import("./pages/business/BusinessSupport"));
const BusinessBillingPage = lazy(() => import("./pages/business/BusinessBilling"));
const BusinessQuotePage = lazy(() => import("./pages/business/BusinessQuote"));
const BusinessContactsPage = lazy(() => import("./pages/business/BusinessContacts"));
const BusinessNotificationPreferencesPage = lazy(() => import("./pages/business/NotificationPreferences"));
const SimIndex = lazy(() => import("./pages/sim/SimIndex"));
const SimCheckout = lazy(() => import("./pages/sim/SimCheckout"));
const SimOrderSuccess = lazy(() => import("./pages/sim/SimOrderSuccess"));
import AcceptableUse from "./pages/legal/AcceptableUse";
import ComplaintsCode from "./pages/legal/ComplaintsCode";
import VulnerableCustomers from "./pages/legal/VulnerableCustomers";
import Accessibility from "./pages/legal/Accessibility";
import ModernSlavery from "./pages/legal/ModernSlavery";
import CodeOfPractice from "./pages/legal/CodeOfPractice";
import PriceTransparency from "./pages/legal/PriceTransparency";
import SwitchingPolicy from "./pages/legal/SwitchingPolicy";
import NetworkManagement from "./pages/legal/NetworkManagement";

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
      <PrivateRouteNoIndex />
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
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
            <Route path="billing/reconciliation" element={<Suspense fallback={<AdminRouteFallback />}><AdminBillingReconciliation /></Suspense>} />
            <Route path="billing/chain-check" element={<Suspense fallback={<AdminRouteFallback />}><AdminBillingChainCheck /></Suspense>} />
            <Route path="legacy-remediation" element={<Suspense fallback={<AdminRouteFallback />}><AdminLegacyRemediation /></Suspense>} />
            <Route path="abhay-remediation" element={<Suspense fallback={<AdminRouteFallback />}><AdminAbhayRemediation /></Suspense>} />
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
            <Route path="live-chat" element={<Suspense fallback={<AdminRouteFallback />}><AdminLiveChat /></Suspense>} />
            <Route path="webhook-monitor" element={<Suspense fallback={<AdminRouteFallback />}><AdminWebhookMonitor /></Suspense>} />
            <Route path="notification-settings" element={<Suspense fallback={<AdminRouteFallback />}><AdminNotificationSettings /></Suspense>} />
            <Route path="notification-events" element={<Suspense fallback={<AdminRouteFallback />}><AdminNotificationEvents /></Suspense>} />
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
            <Route path="blog" element={<Suspense fallback={<AdminRouteFallback />}><AdminBlogEditor /></Suspense>} />
            <Route path="fair-pricing" element={<Suspense fallback={<AdminRouteFallback />}><AdminFairPricing /></Suspense>} />
            <Route path="suppliers/giacom-import" element={<Suspense fallback={<AdminRouteFallback />}><AdminSuppliersGiacomImport /></Suspense>} />
            <Route path="sim-plans" element={<Suspense fallback={<AdminRouteFallback />}><AdminSimPlans /></Suspense>} />
            <Route path="sim-orders" element={<Suspense fallback={<AdminRouteFallback />}><AdminSimOrders /></Suspense>} />
            {/* Business-admin gated section */}
            <Route element={<ProtectedAdminRoute requiredRoles={["business_admin", "ticket_admin", "super_admin", "admin"]} />}>
              <Route path="business-leads" element={<Suspense fallback={<AdminRouteFallback />}><AdminBusinessLeads /></Suspense>} />
              <Route path="business-quotes" element={<Suspense fallback={<AdminRouteFallback />}><AdminBusinessQuoteRequests /></Suspense>} />
              <Route path="business-activity" element={<Suspense fallback={<AdminRouteFallback />}><AdminBusinessActivityLog /></Suspense>} />
            </Route>
            {/* Super-admin only: role management */}
            <Route element={<ProtectedAdminRoute requiredRoles={["super_admin", "admin"]} />}>
              <Route path="roles" element={<Suspense fallback={<AdminRouteFallback />}><AdminRolesPermissions /></Suspense>} />
            </Route>
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
        <Route path="/quote/two-doc/:token" element={<Suspense fallback={<div className="p-12 text-center">Loading…</div>}><TwoDocAcceptance /></Suspense>} />
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
        <Route path="/sim-plans" element={<Navigate to="/sim" replace />} />
        <Route path="/sim" element={<Suspense fallback={<AdminRouteFallback />}><SimIndex /></Suspense>} />
        <Route path="/sim/checkout" element={<Suspense fallback={<AdminRouteFallback />}><SimCheckout /></Suspense>} />
        <Route path="/sim/order-success/:orderId" element={<Suspense fallback={<AdminRouteFallback />}><SimOrderSuccess /></Suspense>} />
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
        <Route path="/business" element={<Suspense fallback={<AdminRouteFallback />}><BusinessHub /></Suspense>} />
        <Route path="/business/broadband" element={<Suspense fallback={<AdminRouteFallback />}><BusinessBroadbandPage /></Suspense>} />
        <Route path="/business/voice" element={<Suspense fallback={<AdminRouteFallback />}><BusinessVoicePage /></Suspense>} />
        <Route path="/business/sim" element={<Suspense fallback={<AdminRouteFallback />}><BusinessSimPage /></Suspense>} />
        <Route path="/business/bundles" element={<Suspense fallback={<AdminRouteFallback />}><BusinessBundlesPage /></Suspense>} />
        <Route path="/business/industries/:slug" element={<Suspense fallback={<AdminRouteFallback />}><BusinessIndustryPage /></Suspense>} />
        <Route path="/business/contact-sales" element={<Suspense fallback={<AdminRouteFallback />}><BusinessContactSalesPage /></Suspense>} />
        <Route path="/business/support" element={<Suspense fallback={<AdminRouteFallback />}><BusinessSupportPage /></Suspense>} />
        <Route path="/business/billing" element={<Suspense fallback={<AdminRouteFallback />}><BusinessBillingPage /></Suspense>} />
        <Route path="/business/quote" element={<Suspense fallback={<AdminRouteFallback />}><BusinessQuotePage /></Suspense>} />
        <Route path="/business/contacts" element={<Suspense fallback={<AdminRouteFallback />}><BusinessContactsPage /></Suspense>} />
        <Route path="/business/notifications" element={<Suspense fallback={<AdminRouteFallback />}><BusinessNotificationPreferencesPage /></Suspense>} />
        <Route path="/business-legacy" element={<Business />} />
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
        <Route path="/guides/:slug" element={<Suspense fallback={null}><DbGuidePage /></Suspense>} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/help/own-router-setup" element={<OwnRouterSetup />} />
        <Route path="/help/:slug" element={<Suspense fallback={null}><DbHelpArticle /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={null}><BlogIndex /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />

        {/* /learn hub + long-tail SEO explainers */}
        <Route path="/learn" element={<Suspense fallback={null}><LearnHub /></Suspense>} />
        <Route path="/learn/:slug" element={<Suspense fallback={null}><LearnPage /></Suspense>} />

        {/* Location broadband pages (50 cities) — explicit routes keep the sitemap and SEO scans in sync. */}
        <Route path="/broadband-london" element={<LocationBroadband />} />
        <Route path="/broadband-manchester" element={<LocationBroadband />} />
        <Route path="/broadband-birmingham" element={<LocationBroadband />} />
        <Route path="/broadband-leeds" element={<LocationBroadband />} />
        <Route path="/broadband-glasgow" element={<LocationBroadband />} />
        <Route path="/broadband-liverpool" element={<LocationBroadband />} />
        <Route path="/broadband-sheffield" element={<LocationBroadband />} />
        <Route path="/broadband-bristol" element={<LocationBroadband />} />
        <Route path="/broadband-leicester" element={<LocationBroadband />} />
        <Route path="/broadband-nottingham" element={<LocationBroadband />} />
        <Route path="/broadband-edinburgh" element={<LocationBroadband />} />
        <Route path="/broadband-cardiff" element={<LocationBroadband />} />
        <Route path="/broadband-newcastle" element={<LocationBroadband />} />
        <Route path="/broadband-southampton" element={<LocationBroadband />} />
        <Route path="/broadband-coventry" element={<LocationBroadband />} />
        <Route path="/broadband-brighton" element={<LocationBroadband />} />
        <Route path="/broadband-plymouth" element={<LocationBroadband />} />
        <Route path="/broadband-stoke-on-trent" element={<LocationBroadband />} />
        <Route path="/broadband-wolverhampton" element={<LocationBroadband />} />
        <Route path="/broadband-derby" element={<LocationBroadband />} />
        <Route path="/broadband-swansea" element={<LocationBroadband />} />
        <Route path="/broadband-aberdeen" element={<LocationBroadband />} />
        <Route path="/broadband-reading" element={<LocationBroadband />} />
        <Route path="/broadband-sunderland" element={<LocationBroadband />} />
        <Route path="/broadband-norwich" element={<LocationBroadband />} />
        <Route path="/broadband-luton" element={<LocationBroadband />} />
        <Route path="/broadband-preston" element={<LocationBroadband />} />
        <Route path="/broadband-milton-keynes" element={<LocationBroadband />} />
        <Route path="/broadband-northampton" element={<LocationBroadband />} />
        <Route path="/broadband-dundee" element={<LocationBroadband />} />
        <Route path="/broadband-york" element={<LocationBroadband />} />
        <Route path="/broadband-portsmouth" element={<LocationBroadband />} />
        <Route path="/broadband-exeter" element={<LocationBroadband />} />
        <Route path="/broadband-cambridge" element={<LocationBroadband />} />
        <Route path="/broadband-oxford" element={<LocationBroadband />} />
        <Route path="/broadband-bath" element={<LocationBroadband />} />
        <Route path="/broadband-bournemouth" element={<LocationBroadband />} />
        <Route path="/broadband-middlesbrough" element={<LocationBroadband />} />
        <Route path="/broadband-bolton" element={<LocationBroadband />} />
        <Route path="/broadband-blackpool" element={<LocationBroadband />} />
        <Route path="/broadband-ipswich" element={<LocationBroadband />} />
        <Route path="/broadband-peterborough" element={<LocationBroadband />} />
        <Route path="/broadband-huddersfield" element={<LocationBroadband />} />
        <Route path="/broadband-wakefield" element={<LocationBroadband />} />
        <Route path="/broadband-hull" element={<LocationBroadband />} />
        <Route path="/broadband-warrington" element={<LocationBroadband />} />
        <Route path="/broadband-doncaster" element={<LocationBroadband />} />
        <Route path="/broadband-stockport" element={<LocationBroadband />} />
        <Route path="/broadband-wigan" element={<LocationBroadband />} />
        <Route path="/broadband-cheltenham" element={<LocationBroadband />} />

        {/* Comparison pages */}
        <Route path="/compare/no-contract-broadband" element={<NoContractBroadbandComparison />} />
        <Route path="/rolling-vs-fixed-broadband-comparison" element={<RollingVsFixedBroadbandComparison />} />
        <Route path="/compare/:slug" element={<ComparisonPage />} />

        {/* Keyword landing pages */}
        <Route path="/cheap-broadband-near-me" element={<KeywordLanding />} />
        <Route path="/broadband-no-credit-check" element={<KeywordLanding />} />
        <Route path="/broadband-for-students" element={<KeywordLanding />} />
        <Route path="/best-broadband-deals-uk" element={<KeywordLanding />} />
        <Route path="/broadband-for-gaming" element={<KeywordLanding />} />
        <Route path="/broadband-for-working-from-home" element={<KeywordLanding />} />
        <Route path="/broadband-no-upfront-cost" element={<KeywordLanding />} />
        {/* SEO content pages */}
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/coverage" element={<CoveragePage />} />
        <Route path="/coverage-areas" element={<Suspense fallback={null}><CoverageAreas /></Suspense>} />
        <Route path="/routers" element={<Suspense fallback={null}><RoutersPage /></Suspense>} />
        <Route path="/broadband-plans" element={<Suspense fallback={null}><BroadbandPlansSeo /></Suspense>} />
        <Route path="/sim-only-plans" element={<Suspense fallback={null}><SimOnlyPlansSeo /></Suspense>} />
        <Route path="/switch-broadband-provider" element={<Suspense fallback={null}><SwitchBroadbandSeo /></Suspense>} />
        <Route path="/landline-plans" element={<Suspense fallback={null}><LandlinePlansSeo /></Suspense>} />
        <Route path="/fibre-broadband" element={<FibreBroadbandPage />} />
        <Route path="/broadband-and-digital-voice" element={<BroadbandAndDigitalVoicePage />} />
        <Route path="/small-business-telecom" element={<SmallBusinessTelecomPage />} />
        <Route path="/billing-explained" element={<BillingExplainedPage />} />
        <Route path="/first-invoice-explained" element={<FirstInvoiceExplainedPage />} />
        <Route path="/direct-debit-setup" element={<DirectDebitSetupPage />} />
        <Route path="/pay-by-card" element={<PayByCardPage />} />
        <Route path="/cancellation" element={<CancellationPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/vulnerable-customers" element={<VulnerableCustomersPublicPage />} />

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
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
