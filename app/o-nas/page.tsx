import type { Metadata } from "next";
import SiteHeader, { PageIntro } from "@/components/site/SiteHeader";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "О нас — АгроСфера",
  description: "АгроСфера — котировки агрокультур от предприятий и сделки между производителями, экспортёрами и агентами.",
};

const WHAT = [
  ["Котировки", "Каждый день собираем цены и свободные объёмы предприятий по регионам России и заявки экспортёров и агентов."],
  ["Сделки", "Когда цены покупателя и продавца сходятся, проверяем стороны, согласуем условия и сопровождаем отгрузку."],
  ["Участники", "Предприятия-производители, экспортёры и агенты, которые работают с масличными и зерновыми культурами."],
];

const PRINCIPLES = [
  ["Только проверенные компании", "Каждого участника проверяет менеджер, прежде чем открыть доступ."],
  ["Анонимный стакан", "Названия и контакты сторон видит только АгроСфера."],
  ["Цены из первых рук", "Цены публикуют сами предприятия, без перекупщиков."],
  ["Защита от ошибок", "Сайт и бот проверяют каждую цифру, спорные цены проверяет менеджер."],
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader active="about" />
      <PageIntro
        title="О нас"
        lead="АгроСфера — площадка котировок агрокультур. Мы собираем цены предприятий и заявки покупателей в одном стакане и проводим сделки между ними."
      />

      <section className="px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 md:gap-10">
          {WHAT.map(([t, d]) => (
            <div key={t} className="border-t-2 border-[#1F5A25] pt-5">
              <h2 className="text-xl font-semibold text-gray-900">{t}</h2>
              <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f4f6f2] px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900">Принципы</h2>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {PRINCIPLES.map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white border border-gray-200 p-6">
                <p className="text-lg font-semibold text-gray-900">{t}</p>
                <p className="mt-1.5 text-[15px] text-gray-600 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
