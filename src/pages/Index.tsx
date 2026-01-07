import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import WhyUsSection from "@/components/home/WhyUsSection";
import CTASection from "@/components/home/CTASection";
import AppHome from "@/components/app/AppHome";
import { useAppMode } from "@/hooks/useAppMode";

const Index = () => {
  const { isAppMode } = useAppMode();

  // App mode: show compact app-like UI
  if (isAppMode) {
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
