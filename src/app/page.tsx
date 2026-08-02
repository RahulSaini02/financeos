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
  applicationName: "FinanceOS",
  description:
    "FinanceOS is a personal finance management app. Connect accounts, track every dollar, set budgets, and let a Claude AI agent act on your behalf.",
  openGraph: {
    title: "FinanceOS — Your finances, finally intelligent",
    description:
      "FinanceOS is a personal finance management app. Connect accounts, track every dollar, and let a Claude AI agent act on your behalf.",
    siteName: "FinanceOS",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FinanceOS",
  url: "https://myfinos.app",
  description:
    "FinanceOS is a personal finance management application. Track transactions, budgets, savings goals, subscriptions, loans, and investments. Powered by a Claude AI agent.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function HeroPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
