import type { Metadata } from "next";
import SiteHeader, { PageIntro } from "@/components/site/SiteHeader";
import FAQ from "@/components/site/FAQ";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Вопросы и ответы — АгроСфера",
  description: "Откуда берутся цены, как стать участником и как проходит сделка.",
};

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader active="faq" />
      <PageIntro title="Вопросы и ответы" lead="Коротко о котировках, участии и сделках." />
      <FAQ />
      <Footer withForm={false} />
    </main>
  );
}
