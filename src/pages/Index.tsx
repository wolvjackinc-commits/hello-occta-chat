import ResponsiveLayout from "@/components/layout/ResponsiveLayout";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import WhyUsSection from "@/components/home/WhyUsSection";
import CTASection from "@/components/home/CTASection";

const Index = () => {
  return (
    <ResponsiveLayout>
      <HeroSection />
      <ServicesSection />
      <WhyUsSection />
      <CTASection />
    </ResponsiveLayout>
  );
};

export default Index;
