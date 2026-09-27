import type { Metadata } from "next";
import MarketProvider from "@/components/market/MarketProvider";
import SiteHeader, { PageIntro } from "@/components/site/SiteHeader";
import { PartnerForm, Sides, Why } from "@/components/site/Coop";
import BotSection from "@/components/site/BotSection";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Сотрудничество — АгроСфера",
  description: "Экспортёрам и агентам — проверенные объёмы с известным качеством. Предприятиям — покупатели на объём одним сообщением в день.",
};

export default function CooperationPage() {
  return (
    <MarketProvider>
      <main className="min-h-screen bg-white">
        <SiteHeader active="coop" />
        <PageIntro
          title="Сотрудничество"
          lead="АгроСфера — брокер между предприятиями-производителями и покупателями. Предприятия каждое утро присылают предложения, экспортёры и агенты выбирают объём, сделку ведём мы."
        />
        <Sides />
        <Why />
        <BotSection />
        <PartnerForm />
        <Footer />
      </main>
    </MarketProvider>
  );
}
