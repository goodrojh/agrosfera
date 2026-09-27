import type { Metadata } from "next";
import SiteHeader, { PageIntro } from "@/components/site/SiteHeader";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "О нас — АгроСфера",
  description: "АгроСфера — агроброкер: собираем ежедневные предложения проверенных предприятий и проводим сделки с экспортёрами и агентами.",
};

const WHAT = [
  ["Сводка", "Каждое утро предприятия-партнёры присылают цену, объём и качество продукции. Мы публикуем их в сводке по регионам и культурам."],
  ["Сделки", "Экспортёры и агенты оставляют заявки. Мы проверяем партию, согласуем условия, выкупаем и отгружаем."],
  ["Партнёры", "Предприятия-производители масличных и зерновых культур, прошедшие проверку документов."],
];

const PRINCIPLES = [
  ["Проверка до публикации", "Документы и склад предприятия проверяем заранее — в сводку попадают только партнёры."],
  ["Качество в каждом предложении", "Влажность, сорная примесь, масличность или протеин — видно до заявки."],
  ["Название предприятия скрыто", "Покупатель видит регион, объём, качество и цену. Стороны сводит менеджер."],
  ["Свежие данные", "Предложения обновляются каждое утро и уходят из сводки, если предприятие не отвечает 3 дня."],
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader active="about" />
      <PageIntro
        title="О нас"
        lead="АгроСфера — агроброкер. Мы работаем с проверенными предприятиями-производителями и проводим сделки с экспортёрами и агентами. Сводка предложений — наш инструмент, чтобы покупатель видел реальные объёмы каждый день."
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
