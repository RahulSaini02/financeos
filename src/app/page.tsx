import MarketingNav from "@/components/marketing/MarketingNav";
import HeroSection from "@/components/marketing/HeroSection";
import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import SocialProof from "@/components/marketing/SocialProof";
import DemoPreview from "@/components/marketing/DemoPreview";
import Footer from "@/components/marketing/Footer";

export const metadata = {
  title: "FinanceOS — Your finances, finally intelligent",
  description:
    "FinanceOS connects all your accounts, tracks every dollar, and lets an AI agent act on your behalf. Budgets, subscriptions, savings goals, and more.",
  openGraph: {
    title: "FinanceOS — Your finances, finally intelligent",
    description:
      "FinanceOS connects all your accounts, tracks every dollar, and lets an AI agent act on your behalf.",
  },
};

export default function HeroPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <MarketingNav />
      <main>
        <HeroSection />
        <FeaturesGrid />
        <DemoPreview />
        <SocialProof />
      </main>
      <Footer />
    </div>
  );
}
