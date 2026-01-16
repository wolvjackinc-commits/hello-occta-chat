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
import { SEO } from "@/components/seo";

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
        title="Home"
        description="OCCTA provides affordable broadband, SIM plans, and landline services across the UK. Check availability and get connected today with speeds up to 900Mbps."
        canonical="/"
      />
      <HeroSection />
      <ServicesSection />
      <WhyUsSection />
      <CustomerLoveSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
