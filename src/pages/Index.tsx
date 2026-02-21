import { useState, useEffect, lazy, Suspense } from "react";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import HeroSection from "@/components/home/HeroSection";
import { useAppMode } from "@/hooks/useAppMode";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/seo";

// Lazy-load below-fold & non-critical components
const ServicesSection = lazy(() => import("@/components/home/ServicesSection"));
const WhyUsSection = lazy(() => import("@/components/home/WhyUsSection"));
const CustomerLoveSection = lazy(() => import("@/components/home/CustomerLoveSection"));
const CTASection = lazy(() => import("@/components/home/CTASection"));
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
    // Show welcome screen for non-logged in users
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
    <Layout>
      <SEO 
        title="Cheap UK Broadband & SIM Plans"
        description="Cheap broadband UK from £22.99/mo. No contract broadband with 900Mbps speeds, 5G SIM plans from £7.99, landline from £7.99. No credit check, cancel anytime. Get connected today!"
        canonical="/"
        keywords="cheap broadband UK, no contract broadband, cancel anytime broadband, affordable internet UK, 5G SIM no credit check, cheap SIM deals UK, budget broadband 2025, fibre broadband no contract, unlimited broadband UK, OCCTA broadband"
        price="22.99"
      />
      <HeroSection />
      <Suspense fallback={null}>
        <ServicesSection />
        <WhyUsSection />
        <CustomerLoveSection />
        <CTASection />
      </Suspense>
    </Layout>
  );
};

export default Index;
