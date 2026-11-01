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
import CanonicalPath from "@/components/seo/CanonicalPath";
import { captureCampaignFromLocation } from "@/lib/campaignAttribution";
import { captureReferralFromUrl } from "@/lib/referral";
import OcctaLoader from "@/components/loading/OcctaLoader";
import Index from "./pages/Index";
const Auth = lazy(() => import("./pages/Auth"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
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
const AdminPaymentReconciliation = lazy(() => import("./pages/admin/PaymentReconciliation").then(m => ({ default: m.AdminPaymentReconciliation })));
const AdminPaymentDetails = lazy(() => import("./pages/admin/PaymentReconciliation").then(m => ({ default: m.AdminPaymentDetails })));
const AdminBillingChainCheck = lazy(() => import("./pages/admin/BillingChainCheck").then(m => ({ default: m.AdminBillingChainCheck })));
const AdminLegacyRemediation = lazy(() => import("./pages/admin/LegacyRemediation").then(m => ({ default: m.AdminLegacyRemediation })));
const AdminAbhayRemediation = lazy(() => import("./pages/admin/AbhayRemediation").then(m => ({ default: m.AdminAbhayRemediation })));
const AdminBanksRemediation = lazy(() => import("./pages/admin/BanksRemediation").then(m => ({ default: m.AdminBanksRemediation })));
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
const Pay = lazy(() => import("./pages/Pay"));
const PayInternalReturn = lazy(() => import("./pages/PayInternalReturn"));
const DDSetup = lazy(() => import("./pages/DDSetup"));
import Landline from "./pages/Landline";
const Checkout = lazy(() => import("./pages/Checkout"));
const PreCheckout = lazy(() => import("./pages/PreCheckout"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
import Support from "./pages/Support";
import Faq from "./pages/Faq";
import About from "./pages/About";
const Install = lazy(() => import("./pages/Install"));
const Offline = lazy(() => import("./pages/Offline"));
const OrderLookup = lazy(() => import("./pages/OrderLookup"));
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
const ServiceStatus = lazy(() => import("./pages/ServiceStatus"));
import Complaints from "./pages/Complaints";
const PayInvoice = lazy(() => import("./pages/PayInvoice"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const BillingSettings = lazy(() => import("./pages/BillingSettings"));
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
// Admin shell is lazy so the admin bundle never loads on public pages.
const ProtectedAdminRoute = lazy(() => import("./components/admin/layout/ProtectedAdminRoute").then((m) => ({ default: m.ProtectedAdminRoute })));
const AdminLayout = lazy(() => import("./components/admin/layout/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const ProductLanding = lazy(() => import("./pages/ProductLanding"));
const LearnHub = lazy(() => import("./pages/learn/LearnHub"));
const LearnPage = lazy(() => import("./pages/learn/LearnPage"));
const CoverageAreas = lazy(() => import("./pages/CoverageAreas"));
const RoutersPage = lazy(() => import("./pages/seo/Routers"));
const BroadbandPlansSeo = lazy(() => import("./pages/seo/BroadbandPlans"));
const SimOnlyPlansSeo = lazy(() => import("./pages/seo/SimOnlyPlans"));
const SwitchBroadbandSeo = lazy(() => import("./pages/seo/SwitchBroadband"));
const LettingAgentPartners = lazy(() => import("./pages/partners/LettingAgentPartners"));
const PartnerLanding = lazy(() => import("./pages/partners/PartnerLanding"));
const Switch50OfferSeo = lazy(() => import("./pages/seo/Switch50Offer"));
const LandlinePlansSeo = lazy(() => import("./pages/seo/LandlinePlans"));
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
const BuildPlan = lazy(() => import("./pages/BuildPlan"));
const OrderStart = lazy(() => import("./pages/order/OrderStart"));
const OrderJourney = lazy(() => import("./pages/order/OrderJourney"));
const OrderComplete = lazy(() => import("./pages/order/OrderComplete"));
import QuoteStart from "./pages/quote/QuoteStart";
const QuoteThankYou = lazy(() => import("./pages/quote/QuoteThankYou"));
const UnifiedJourney = lazy(() => import("./pages/quote/UnifiedJourney"));
const ContractSummaryView = lazy(() => import("./pages/quote/ContractSummaryView"));
const QuotePayment = lazy(() => import("./pages/quote/QuotePayment"));
const TwoDocAcceptance = lazy(() => import("./pages/quote/TwoDocAcceptance"));
const ContractSummaryAuthedView = lazy(() => import("./pages/dashboard/ContractSummaryAuthedView"));
const ReceiptView = lazy(() => import("./pages/ReceiptView"));
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
const AdminServiceStatus = lazy(() => import("./pages/admin/ServiceStatusAdmin"));
const AdminKnowledgeBase = lazy(() => import("./pages/admin/KnowledgeBase").then(m => ({ default: m.AdminKnowledgeBase })));
const AdminBlogEditor = lazy(() => import("./pages/admin/BlogEditor").then(m => ({ default: m.AdminBlogEditor })));
const AdminFairPricing = lazy(() => import("./pages/admin/FairPricing").then(m => ({ default: m.AdminFairPricing })));
const AdminSuppliersGiacomImport = lazy(() => import("./pages/admin/SuppliersGiacomImport").then(m => ({ default: m.AdminSuppliersGiacomImport })));
const AdminCustomerJourney = lazy(() => import("./pages/admin/CustomerJourney"));
const AdminJourneyControl = lazy(() => import("./pages/admin/JourneyControl"));
const AdminNetworkValidation = lazy(() => import("./pages/admin/NetworkValidation"));
const AdminSimPlans = lazy(() => import("./pages/admin/SimPlansAdmin").then(m => ({ default: m.AdminSimPlans })));
const AdminSimOrders = lazy(() => import("./pages/admin/SimOrders").then(m => ({ default: m.AdminSimOrders })));
const AdminBusinessLeads = lazy(() => import("./pages/admin/BusinessLeads"));
const AdminBusinessQuoteRequests = lazy(() => import("./pages/admin/BusinessQuoteRequests"));
const AdminBusinessActivityLog = lazy(() => import("./pages/admin/BusinessActivityLog"));
const AdminRolesPermissions = lazy(() => import("./pages/admin/RolesPermissions"));
const AdminOutreach = lazy(() => import("./pages/admin/Outreach"));
const AdminPartners = lazy(() => import("./pages/admin/Partners"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
// New business hub (replaces legacy /business page)
const BusinessHub = lazy(() => import("./pages/business/BusinessHub"));
const BusinessBroadbandPage = lazy(() => import("./pages/business/BusinessBroadband"));
const BusinessVoicePage = lazy(() => import("./pages/business/BusinessVoice"));
const BusinessSimPage = lazy(() => import("./pages/business/BusinessSim"));
const BusinessBundlesPage = lazy(() => import("./pages/business/BusinessBundles"));
const BusinessIndustryPage = lazy(() => import("./pages/business/BusinessIndustry"));
const BusinessContactSalesPage = lazy(() => import("./pages/business/BusinessContactSales"));
const BusinessLineCheckPage = lazy(() => import("./pages/business/LineCheck"));
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
import ReferAFriendTerms from "./pages/legal/ReferAFriendTerms";
import ReferAFriend from "./pages/ReferAFriend";
import { MotionConfig } from "framer-motion";
import RouteShutter from "@/components/brand/RouteShutter";
import Layout from "@/components/layout/Layout";

const LocationBroadband = lazy(() => import("./pages/LocationBroadband"));
const queryClient = new QueryClient();

const AdminRouteFallback = () => <OcctaLoader context="admin" variant="page" showTips={false} />;
// Keeps the checkout header and the same "Setting up your order" loader on screen
// while an order page's code downloads, so the hand-off never flashes blank.
const OrderRouteFallback = () => (
  <Layout>
    <section className="container mx-auto max-w-xl px-4 py-16">
      <OcctaLoader context="checkout" label="Setting up your order…" className="px-0 py-0 text-left" />
    </section>
  </Layout>
);
const CityPage = () => (
  <Suspense fallback={<div className="container mx-auto px-4 py-16 text-muted-foreground">Opening this city page…</div>}>
    <LocationBroadband />
  </Suspense>
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

  useEffect(() => {
    captureCampaignFromLocation();
  }, [location.pathname, location.search]);

  // Show offline page when not connected (except for cached pages)
  if (!isOnline && !navigator.onLine) {
    return <Offline />;
  }

  return (
    <>
      <ScrollToTop />
      <RouteShutter />
      <CanonicalPath />
      <PrivateRouteNoIndex />
      {/* Transactional pages are lazy; this boundary covers them. */}
      <Suspense fallback={null}>
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/*" element={<Suspense fallback={<AdminRouteFallback />}><ProtectedAdminRoute /></Suspense>}>
          <Route element={<Suspense fallback={<AdminRouteFallback />}><AdminLayout /></Suspense>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Suspense fallback={<AdminRouteFallback />}><AdminOverview /></Suspense>} />
            <Route path="customers" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomers /></Suspense>} />
            <Route path="customers/:accountNumber" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomerDetail /></Suspense>} />
            <Route path="customers/:accountNumber/journey" element={<Suspense fallback={<AdminRouteFallback />}><AdminCustomerJourney /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<AdminRouteFallback />}><AdminOrders /></Suspense>} />
            <Route path="tickets" element={<Suspense fallback={<AdminRouteFallback />}><AdminTickets /></Suspense>} />
            <Route path="billing" element={<Suspense fallback={<AdminRouteFallback />}><AdminBilling /></Suspense>} />
            <Route path="billing/reconciliation" element={<Suspense fallback={<AdminRouteFallback />}><AdminBillingReconciliation /></Suspense>} />
            <Route path="billing/payment-reconciliation" element={<Suspense fallback={<AdminRouteFallback />}><AdminPaymentReconciliation /></Suspense>} />
            <Route path="billing/payment-details" element={<Suspense fallback={<AdminRouteFallback />}><AdminPaymentDetails /></Suspense>} />
            <Route path="billing/chain-check" element={<Suspense fallback={<AdminRouteFallback />}><AdminBillingChainCheck /></Suspense>} />
            <Route path="legacy-remediation" element={<Suspense fallback={<AdminRouteFallback />}><AdminLegacyRemediation /></Suspense>} />
            <Route path="abhay-remediation" element={<Suspense fallback={<AdminRouteFallback />}><AdminAbhayRemediation /></Suspense>} />
            <Route path="banks-remediation" element={<Suspense fallback={<AdminRouteFallback />}><AdminBanksRemediation /></Suspense>} />
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
            <Route path="journey-control" element={<Suspense fallback={<AdminRouteFallback />}><AdminJourneyControl /></Suspense>} />
            <Route path="network-validation" element={<Suspense fallback={<AdminRouteFallback />}><AdminNetworkValidation /></Suspense>} />
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
            <Route path="service-status" element={<Suspense fallback={<AdminRouteFallback />}><AdminServiceStatus /></Suspense>} />
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
            {/* Outreach campaign manager */}
            <Route element={<ProtectedAdminRoute requiredRoles={["super_admin", "admin"]} />}>
              <Route path="outreach" element={<Suspense fallback={<AdminRouteFallback />}><AdminOutreach /></Suspense>} />
              <Route path="partners" element={<Suspense fallback={<AdminRouteFallback />}><AdminPartners /></Suspense>} />
            </Route>
            {/* Super-admin only: role management */}
            <Route element={<ProtectedAdminRoute requiredRoles={["super_admin", "admin"]} />}>
              <Route path="roles" element={<Suspense fallback={<AdminRouteFallback />}><AdminRolesPermissions /></Suspense>} />
            </Route>
          </Route>
        </Route>
        <Route path="/broadband" element={<Broadband />} />
        <Route path="/order" element={<Suspense fallback={<OrderRouteFallback />}><OrderStart /></Suspense>} />
        <Route path="/broadband/flex" element={<FlexBroadband />} />
        <Route path="/broadband/contract-saver" element={<ContractSaverBroadband />} />
        <Route path="/switching" element={<SwitchingPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/quote/start" element={<QuoteStart />} />
        <Route path="/quote/thank-you" element={<QuoteThankYou />} />
        <Route path="/quote/contract-summary/:token" element={<ContractSummaryView />} />
        <Route path="/quote/two-doc/:token" element={<Suspense fallback={<OcctaLoader context="documents" variant="page" />}><TwoDocAcceptance /></Suspense>} />
        <Route path="/dashboard/contract/:csId" element={<ContractSummaryAuthedView />} />
        <Route path="/dashboard/receipt/:id" element={<ReceiptView mode="auth" />} />
        <Route path="/receipt/:token" element={<ReceiptView mode="token" />} />
        <Route path="/quote/payment/:token" element={<QuotePayment />} />
        <Route path="/quote/:token" element={<UnifiedJourney />} />
        <Route path="/order" element={<Suspense fallback={<OrderRouteFallback />}><OrderStart /></Suspense>} />
        <Route path="/order/:token" element={<Suspense fallback={<OrderRouteFallback />}><OrderJourney /></Suspense>} />
        <Route path="/order/:token/complete" element={<Suspense fallback={<OrderRouteFallback />}><OrderComplete /></Suspense>} />
        <Route path="/legal/acceptable-use" element={<AcceptableUse />} />
        <Route path="/legal/complaints-code" element={<ComplaintsCode />} />
        <Route path="/legal/vulnerable-customers" element={<VulnerableCustomers />} />
        <Route path="/legal/accessibility" element={<Accessibility />} />
        <Route path="/legal/modern-slavery" element={<ModernSlavery />} />
        <Route path="/legal/code-of-practice" element={<CodeOfPractice />} />
        <Route path="/legal/price-transparency" element={<PriceTransparency />} />
        <Route path="/legal/switching-policy" element={<SwitchingPolicy />} />
        <Route path="/legal/network-management" element={<NetworkManagement />} />
        <Route path="/legal/refer-a-friend-terms" element={<ReferAFriendTerms />} />
        <Route path="/refer-a-friend" element={<ReferAFriend />} />
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
        <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
        <Route path="/unsubscribe" element={<Suspense fallback={<AdminRouteFallback />}><Unsubscribe /></Suspense>} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
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
        <Route path="/business/line-check" element={<Suspense fallback={<AdminRouteFallback />}><BusinessLineCheckPage /></Suspense>} />
        <Route path="/business/support" element={<Suspense fallback={<AdminRouteFallback />}><BusinessSupportPage /></Suspense>} />
        <Route path="/business/billing" element={<Suspense fallback={<AdminRouteFallback />}><BusinessBillingPage /></Suspense>} />
        <Route path="/business/quote" element={<Suspense fallback={<AdminRouteFallback />}><BusinessQuotePage /></Suspense>} />
        <Route path="/business/contacts" element={<Suspense fallback={<AdminRouteFallback />}><BusinessContactsPage /></Suspense>} />
        <Route path="/business/notifications" element={<Suspense fallback={<AdminRouteFallback />}><BusinessNotificationPreferencesPage /></Suspense>} />
        <Route path="/business-legacy" element={<Navigate to="/business" replace />} />
        <Route path="/business-offers" element={<Navigate to="/business/bundles" replace />} />
        <Route path="/business-checkout" element={<Navigate to="/business/quote" replace />} />
        <Route path="/business-sales" element={<Navigate to="/business/contact-sales" replace />} />
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
        {/* Retired card / Worldpay payment articles linked from older emails. */}
        <Route path="/help/how-to-pay-by-invoice-link" element={<Navigate to="/help/pay-by-bank-transfer" replace />} />
        <Route path="/help/what-to-do-if-your-card-payment-fails" element={<Navigate to="/help/missed-payment-help" replace />} />
        <Route path="/guides/invoice-link-payment-guide" element={<Navigate to="/help/pay-by-bank-transfer" replace />} />
        <Route path="/help/:slug" element={<Suspense fallback={null}><DbHelpArticle /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={null}><BlogIndex /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />

        {/* /learn hub + long-tail SEO explainers */}
        <Route path="/learn" element={<Suspense fallback={null}><LearnHub /></Suspense>} />
        <Route path="/learn/:slug" element={<Suspense fallback={null}><LearnPage /></Suspense>} />

        {/* Location broadband pages (50 cities) — explicit routes keep the sitemap and SEO scans in sync. */}
        <Route path="/broadband-london" element={<CityPage />} />
        <Route path="/broadband-bradford" element={<CityPage />} />
        <Route path="/broadband-salford" element={<CityPage />} />
        <Route path="/broadband-solihull" element={<CityPage />} />
        <Route path="/broadband-southend-on-sea" element={<CityPage />} />
        <Route path="/broadband-basildon" element={<CityPage />} />
        <Route path="/broadband-chelmsford" element={<CityPage />} />
        <Route path="/broadband-colchester" element={<CityPage />} />
        <Route path="/broadband-watford" element={<CityPage />} />
        <Route path="/broadband-st-albans" element={<CityPage />} />
        <Route path="/broadband-slough" element={<CityPage />} />
        <Route path="/broadband-high-wycombe" element={<CityPage />} />
        <Route path="/broadband-guildford" element={<CityPage />} />
        <Route path="/broadband-crawley" element={<CityPage />} />
        <Route path="/broadband-maidstone" element={<CityPage />} />
        <Route path="/broadband-canterbury" element={<CityPage />} />
        <Route path="/broadband-swindon" element={<CityPage />} />
        <Route path="/broadband-salisbury" element={<CityPage />} />
        <Route path="/broadband-gloucester" element={<CityPage />} />
        <Route path="/broadband-worcester" element={<CityPage />} />
        <Route path="/broadband-lincoln" element={<CityPage />} />
        <Route path="/broadband-blackburn" element={<CityPage />} />
        <Route path="/broadband-harrogate" element={<CityPage />} />
        <Route path="/broadband-halifax" element={<CityPage />} />
        <Route path="/broadband-rotherham" element={<CityPage />} />
        <Route path="/broadband-barnsley" element={<CityPage />} />
        <Route path="/broadband-chester" element={<CityPage />} />
        <Route path="/broadband-telford" element={<CityPage />} />
        <Route path="/broadband-shrewsbury" element={<CityPage />} />
        <Route path="/broadband-carlisle" element={<CityPage />} />
        <Route path="/broadband-durham" element={<CityPage />} />
        <Route path="/broadband-newport" element={<CityPage />} />
        <Route path="/broadband-wrexham" element={<CityPage />} />
        <Route path="/broadband-torquay" element={<CityPage />} />
        <Route path="/broadband-inverness" element={<CityPage />} />
        <Route path="/broadband-stirling" element={<CityPage />} />
        <Route path="/broadband-paisley" element={<CityPage />} />
        <Route path="/broadband-manchester" element={<CityPage />} />
        <Route path="/broadband-birmingham" element={<CityPage />} />
        <Route path="/broadband-leeds" element={<CityPage />} />
        <Route path="/broadband-glasgow" element={<CityPage />} />
        <Route path="/broadband-liverpool" element={<CityPage />} />
        <Route path="/broadband-sheffield" element={<CityPage />} />
        <Route path="/broadband-bristol" element={<CityPage />} />
        <Route path="/broadband-leicester" element={<CityPage />} />
        <Route path="/broadband-nottingham" element={<CityPage />} />
        <Route path="/broadband-edinburgh" element={<CityPage />} />
        <Route path="/broadband-cardiff" element={<CityPage />} />
        <Route path="/broadband-newcastle" element={<CityPage />} />
        <Route path="/broadband-southampton" element={<CityPage />} />
        <Route path="/broadband-coventry" element={<CityPage />} />
        <Route path="/broadband-brighton" element={<CityPage />} />
        <Route path="/broadband-plymouth" element={<CityPage />} />
        <Route path="/broadband-stoke-on-trent" element={<CityPage />} />
        <Route path="/broadband-wolverhampton" element={<CityPage />} />
        <Route path="/broadband-derby" element={<CityPage />} />
        <Route path="/broadband-swansea" element={<CityPage />} />
        <Route path="/broadband-aberdeen" element={<CityPage />} />
        <Route path="/broadband-reading" element={<CityPage />} />
        <Route path="/broadband-sunderland" element={<CityPage />} />
        <Route path="/broadband-norwich" element={<CityPage />} />
        <Route path="/broadband-luton" element={<CityPage />} />
        <Route path="/broadband-preston" element={<CityPage />} />
        <Route path="/broadband-milton-keynes" element={<CityPage />} />
        <Route path="/broadband-northampton" element={<CityPage />} />
        <Route path="/broadband-dundee" element={<CityPage />} />
        <Route path="/broadband-york" element={<CityPage />} />
        <Route path="/broadband-portsmouth" element={<CityPage />} />
        <Route path="/broadband-exeter" element={<CityPage />} />
        <Route path="/broadband-cambridge" element={<CityPage />} />
        <Route path="/broadband-oxford" element={<CityPage />} />
        <Route path="/broadband-bath" element={<CityPage />} />
        <Route path="/broadband-bournemouth" element={<CityPage />} />
        <Route path="/broadband-middlesbrough" element={<CityPage />} />
        <Route path="/broadband-bolton" element={<CityPage />} />
        <Route path="/broadband-blackpool" element={<CityPage />} />
        <Route path="/broadband-ipswich" element={<CityPage />} />
        <Route path="/broadband-peterborough" element={<CityPage />} />
        <Route path="/broadband-huddersfield" element={<CityPage />} />
        <Route path="/broadband-wakefield" element={<CityPage />} />
        <Route path="/broadband-hull" element={<CityPage />} />
        <Route path="/broadband-warrington" element={<CityPage />} />
        <Route path="/broadband-doncaster" element={<CityPage />} />
        <Route path="/broadband-stockport" element={<CityPage />} />
        <Route path="/broadband-wigan" element={<CityPage />} />
        <Route path="/broadband-cheltenham" element={<CityPage />} />

        {/* Comparison pages */}
        <Route path="/compare/no-contract-broadband" element={<NoContractBroadbandComparison />} />
        <Route path="/rolling-vs-fixed-broadband-comparison" element={<RollingVsFixedBroadbandComparison />} />
        <Route path="/compare/:slug" element={<ComparisonPage />} />

        {/* Keyword landing pages */}
        <Route path="/fixed-price-broadband" element={<KeywordLanding />} />
        <Route path="/cheap-broadband-near-me" element={<KeywordLanding />} />
        <Route path="/broadband-no-credit-check" element={<KeywordLanding />} />
        <Route path="/broadband-for-students" element={<KeywordLanding />} />
        <Route path="/best-broadband-deals-uk" element={<KeywordLanding />} />
        <Route path="/broadband-for-gaming" element={<KeywordLanding />} />
        <Route path="/broadband-for-working-from-home" element={<KeywordLanding />} />
        <Route path="/broadband-no-upfront-cost" element={<KeywordLanding />} />
        {/* Product-category landing pages (src/data/productLandings.ts) */}
        <Route path="/full-fibre-broadband" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/gigabit-broadband" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/ultrafast-broadband" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/superfast-broadband" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/broadband-without-landline" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/moving-house-broadband" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/partners/letting-agents" element={<Suspense fallback={null}><LettingAgentPartners /></Suspense>} />
        <Route path="/p/:code" element={<Suspense fallback={null}><PartnerLanding /></Suspense>} />
        <Route path="/unlimited-data-sim" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/30-day-sim-only" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/esim" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/data-only-sim" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/o2-sim-only-deals" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/vodafone-sim-only-deals" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/ee-sim-only-deals" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/business/leased-lines" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        <Route path="/business/sip-trunks" element={<Suspense fallback={null}><ProductLanding /></Suspense>} />
        {/* SEO content pages */}
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/coverage" element={<CoveragePage />} />
        <Route path="/coverage-areas" element={<Suspense fallback={null}><CoverageAreas /></Suspense>} />
        <Route path="/routers" element={<Suspense fallback={null}><RoutersPage /></Suspense>} />
        <Route path="/broadband-plans" element={<Suspense fallback={null}><BroadbandPlansSeo /></Suspense>} />
        <Route path="/sim-only-plans" element={<Suspense fallback={null}><SimOnlyPlansSeo /></Suspense>} />
        <Route path="/switch-broadband-provider" element={<Suspense fallback={null}><SwitchBroadbandSeo /></Suspense>} />
        <Route path="/broadband-cashback-offer" element={<Suspense fallback={null}><Switch50OfferSeo /></Suspense>} />
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
      </Suspense>
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
          {/* Every framer-motion reveal honours the visitor's reduced-motion setting */}
          <MotionConfig reducedMotion="user">
            <AnimatedRoutes />
            <CookieConsent />
          </MotionConfig>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
