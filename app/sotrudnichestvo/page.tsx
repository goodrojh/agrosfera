import type { Metadata } from "next";
import MarketProvider from "@/components/market/MarketProvider";
import SiteHeader, { PageIntro } from "@/components/site/SiteHeader";
import { CabinetShowcase, Roles, Steps } from "@/components/site/Coop";
import BotSection from "@/components/site/BotSection";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Сотрудничество — АгроСфера",
  description: "Предприятиям, экспортёрам и агентам: регистрация, проверка и работа с котировками в личном кабинете.",
};

export default function CooperationPage() {
  return (
    <MarketProvider>
      <main className="min-h-screen bg-white">
        <SiteHeader active="coop" />
        <PageIntro title="Сотрудничество" lead="Предприятия продают, экспортёры и агенты покупают, АгроСфера проводит сделку. Доступ к инструменту — в личном кабинете после проверки компании." />
        <Roles />
        <Steps />
        <CabinetShowcase />
        <BotSection />
        <Footer />
      </main>
    </MarketProvider>
  );
}
