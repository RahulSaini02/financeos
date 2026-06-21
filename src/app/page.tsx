import MarketingNav from "@/components/marketing/MarketingNav";
import HeroSection from "@/components/marketing/HeroSection";
import TrustBar from "@/components/marketing/TrustBar";
import HowItWorks from "@/components/marketing/HowItWorks";
import FeaturesGrid from "@/components/marketing/FeaturesGrid";
import AIHighlight from "@/components/marketing/AIHighlight";
import FinalCTA from "@/components/marketing/FinalCTA";
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
        <TrustBar />
        <div className="h-px bg-[var(--color-border)]/20" />
        <HowItWorks />
        <FeaturesGrid />
        <AIHighlight />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
