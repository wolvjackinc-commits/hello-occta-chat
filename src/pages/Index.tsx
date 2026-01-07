import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import WhyUsSection from "@/components/home/WhyUsSection";
import CTASection from "@/components/home/CTASection";
import AppHome from "@/components/app/AppHome";
import AppWelcome from "@/components/app/AppWelcome";
import { useAppMode } from "@/hooks/useAppMode";
import { supabase } from "@/integrations/supabase/client";

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
      <HeroSection />
      <ServicesSection />
      <WhyUsSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
