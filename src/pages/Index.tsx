import { useState, useEffect, lazy, Suspense } from "react";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import HeroSection from "@/components/home/HeroSection";
import HowItWorksStrip from "@/components/home/HowItWorksStrip";
import { useAppMode } from "@/hooks/useAppMode";
import { supabase } from "@/integrations/supabase/client";
import { SEO, StructuredData } from "@/components/seo";
import { getFromPrices } from "@/lib/pricing/engine";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";

// Lazy-load below-fold & non-critical components
const ServicesSection = lazy(() => import("@/components/home/ServicesSection"));
const WhyUsSection = lazy(() => import("@/components/home/WhyUsSection"));
const CustomerLoveSection = lazy(() => import("@/components/home/CustomerLoveSection"));
const CTASection = lazy(() => import("@/components/home/CTASection"));
const FairBroadbandPromise = lazy(() => import("@/components/home/FairBroadbandPromise"));
const IncludedFreeSection = lazy(() => import("@/components/home/IncludedFreeSection"));
const AppHome = lazy(() => import("@/components/app/AppHome"));
const AppWelcome = lazy(() => import("@/components/app/AppWelcome"));

const Index = () => {
  const { isAppMode } = useAppMode();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // App mode: show app-like UI
  if (isAppMode) {
    if (!user && !isLoading) {
      return <Suspense fallback={null}><AppWelcome /></Suspense>;
    }
    
    return (
      <AppLayout>
        <Suspense fallback={null}><AppHome /></Suspense>
      </AppLayout>
    );
  }

  // Browser mode: show full website
  return (
    <AvailabilityProvider>
      <Layout>
        <SEO
          title="UK Broadband, SIM & Digital Voice"
          description={`UK broadband from £${getFromPrices().broadband}/mo, 5G SIM from £${getFromPrices().sim}, digital home phone from £${getFromPrices().landline}. Simple telecom. Clear terms.`}
          canonical="/"
          keywords="UK broadband, flexible broadband, price lock broadband, affordable internet UK, 5G SIM UK, SIM deals UK, fibre broadband UK, digital home phone UK, OCCTA broadband"
          price={getFromPrices().broadband}
        />
        <StructuredData type="all" />
        <HeroSection />
        <HowItWorksStrip />
        <Suspense fallback={null}>
          <FairBroadbandPromise />
          <ServicesSection />
          <IncludedFreeSection />
          <WhyUsSection />
          <CustomerLoveSection />
          <CTASection />
        </Suspense>
      </Layout>
    </AvailabilityProvider>
  );
};

export default Index;
