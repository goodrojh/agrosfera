import type { Metadata } from "next";
import MarketProvider from "@/components/market/MarketProvider";
import { PageIntro } from "@/components/site/SiteHeader";
import { ProducersContent } from "@/components/site/Audience";
import BotSection from "@/components/site/BotSection";
import { PartnerForm } from "@/components/site/PartnerForm";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Предприятиям — АгроСфера",
  description: "Станьте партнёром АгроСфера: один раз проходите проверку, а дальше каждое утро присылаете одной строкой цену, объём и качество. Покупателей находим мы.",
};

export default function ProducersPage() {
  return (
    <MarketProvider>
      <main className="min-h-screen bg-white">
        <PageIntro
          active="producers"
          photo="/photos/producers.webp"
          title="Предприятиям"
          lead="Мы один раз проверяем ваше предприятие, а дальше от вас нужно только каждое утро присылать цену, объём и качество продукции. Покупателей-экспортёров находим мы и сами проводим сделку."
        >
          <a href="#partner" className="mt-8 inline-flex items-center rounded-lg bg-white text-[#0b1f0e] px-6 py-3.5 text-[15px] font-semibold hover:bg-white/90">
            Стать партнёром
          </a>
        </PageIntro>
        <ProducersContent />
        <BotSection />
        <PartnerForm />
        <Footer />
      </main>
    </MarketProvider>
  );
}
