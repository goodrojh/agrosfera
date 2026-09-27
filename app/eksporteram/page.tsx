import type { Metadata } from "next";
import MarketProvider from "@/components/market/MarketProvider";
import { PageIntro } from "@/components/site/SiteHeader";
import { ExportersContent } from "@/components/site/Audience";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Экспортёрам — АгроСфера",
  description: "Проверенные объёмы масличных и зерновых культур от предприятий по всей России: цена и качество обновляются каждое утро. Оставьте заявку — проведём сделку и доставим груз в нужную точку.",
};

export default function ExportersPage() {
  return (
    <MarketProvider>
      <main className="min-h-screen bg-white">
        <PageIntro
          active="exporters"
          photo="/photos/exporters.webp"
          title="Экспортёрам"
          lead="Проверенные объёмы масличных и зерновых культур от предприятий по всей России. Цена, объём и качество партии обновляются каждое утро. Выбирайте и оставляйте заявку — мы проведём сделку и доставим груз в нужную вам точку."
        />
        <ExportersContent />
        <Footer />
      </main>
    </MarketProvider>
  );
}
