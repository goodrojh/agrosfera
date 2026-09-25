import type { Metadata } from "next";
import MarketProvider from "@/components/market/MarketProvider";
import CoopHeader from "@/components/site/CoopHeader";
import Partners from "@/components/site/Partners";
import HowItWorks from "@/components/site/HowItWorks";
import BotSection from "@/components/site/BotSection";
import FAQ from "@/components/site/FAQ";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Сотрудничество — АгроСфера",
  description: "Производителям, экспортёрам и агентам: как подать цену через бота, оставить заявку и работать с АгроСферой.",
};

export default function CooperationPage() {
  return (
    <MarketProvider>
      <main className="min-h-screen">
        <CoopHeader />
        <Partners />
        <HowItWorks />
        <BotSection />
        <FAQ />
        <Footer />
      </main>
    </MarketProvider>
  );
}
