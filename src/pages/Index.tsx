import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import WhyUsSection from "@/components/home/WhyUsSection";
import CustomerLoveSection from "@/components/home/CustomerLoveSection";
import CTASection from "@/components/home/CTASection";
import AppHome from "@/components/app/AppHome";
import AppWelcome from "@/components/app/AppWelcome";
import { useAppMode } from "@/hooks/useAppMode";
import { supabase } from "@/integrations/supabase/client";
import { SEO, StructuredData } from "@/components/seo";

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
      return <AppWelcome />;
    }
    
    // Show home for logged in users
    return (
      <AppLayout>
        <AppHome />
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
      <StructuredData type="all" />
      <HeroSection />
      <ServicesSection />
      <WhyUsSection />
      <CustomerLoveSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
