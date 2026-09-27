import type { Metadata } from "next";
import { PageIntro } from "@/components/site/SiteHeader";
import FAQ from "@/components/site/FAQ";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "Вопросы и ответы — АгроСфера",
  description: "Откуда берутся предложения, как оставить заявку и как стать партнёром.",
};

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-white">
      <PageIntro active="faq" photo="/photos/faq.webp" title="Вопросы и ответы" lead="Коротко о сводке, заявках и партнёрстве." />
      <FAQ />
      <Footer />
    </main>
  );
}
