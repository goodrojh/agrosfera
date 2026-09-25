"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowRight, BarChart3, Briefcase, CheckCircle2, FileSignature, Handshake, LineChart, Ship, Sprout } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { computeIndex } from "@/lib/market/aggregate";
import { REGION_BY_ID } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";
import { asset } from "@/lib/config";
import { openLead, type LeadRole } from "@/lib/lead";

type Mockup = "producer" | "exporter" | "agent" | "reading";

interface StepData {
  id: Mockup;
  tabLabel: string;
  tabIcon: React.ReactNode;
  badge: string;
  heading: string;
  steps: string[];
  image: string;
  cta: { label: string; role?: LeadRole; href?: string };
}

const steps: StepData[] = [
  {
    id: "producer",
    tabLabel: "Производителю",
    tabIcon: <Sprout className="w-5 h-5" />,
    badge: "Для предприятий",
    heading: "Цена и объём — каждое утро, одним сообщением.",
    steps: [
      "Оставляете заявку — мы заводим предприятие и присылаем ссылку-приглашение в бот Telegram или MAX.",
      "Каждое утро до 11:00 пишете боту: ЦЕНА ОБЪЁМ, например «31500 200».",
      "Цена или объём изменились — отправляете новое сообщение, котировка обновится сразу.",
      "Появился покупатель по вашей цене — связываемся и согласуем отгрузку.",
    ],
    image: "/media/seeds.jpg",
    cta: { label: "Подключить предприятие", role: "producer" },
  },
  {
    id: "exporter",
    tabLabel: "Экспортёру",
    tabIcon: <Ship className="w-5 h-5" />,
    badge: "Выкуп и доставка",
    heading: "Выбираете регион — мы выкупаем и везём до порта.",
    steps: [
      "Смотрите котировку по своему направлению: для Китая — Сибирь и Дальний Восток, для Чёрного моря — Юг.",
      "Оставляете заявку: объём, направление, пункт поставки.",
      "Мы выкупаем партию у производителей по котировке и организуем доставку до порта или погранперехода.",
      "Один договор и одна точка контакта вместо десятков предприятий.",
    ],
    image: "/media/elevator.jpg",
    cta: { label: "Оставить заявку на объём", role: "exporter" },
  },
  {
    id: "agent",
    tabLabel: "Агенту",
    tabIcon: <Briefcase className="w-5 h-5" />,
    badge: "Агентский договор",
    heading: "Работаете со своим клиентом — мы даём объём и цену.",
    steps: [
      "Видите реальные цены и свободные объёмы без обзвона предприятий.",
      "Заключаем агентский договор.",
      "Сводим вас с производителем по актуальной котировке.",
      "Наше вознаграждение — процент от сделки, закреплённый в договоре.",
    ],
    image: "/media/train.jpg",
    cta: { label: "Обсудить договор", role: "agent" },
  },
  {
    id: "reading",
    tabLabel: "Как читать",
    tabIcon: <LineChart className="w-5 h-5" />,
    badge: "Методика",
    heading: "Индекс — медиана цен на складе производителя.",
    steps: [
      "Цена — ₽ за тонну с НДС на условиях EXW (самовывоз со склада предприятия).",
      "В расчёт идут только сегодняшние цены и только последняя цена каждого предприятия.",
      "Индекс — медиана; «ядро рынка» — диапазон, в котором половина предложений.",
      "Объём — сумма свободных к отгрузке тонн по выбранному региону или направлению.",
    ],
    image: "/media/port.jpg",
    cta: { label: "Открыть котировки", href: "#terminal" },
  },
];

const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const rise: Variants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

function ProducerMockup() {
  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
      <motion.div variants={rise} className="flex items-center justify-between bg-white/80 p-3 rounded-xl border border-white/50 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={asset("/brand/emblem.png")} alt="" className="w-8 h-8 rounded-full" />
          <span className="text-xs font-bold text-[#111]">Бот АгроСфера</span>
        </div>
        <span className="text-[10px] font-bold text-[#1F5A25]">08:05</span>
      </motion.div>
      <motion.div variants={rise} className="ml-auto w-fit bg-[#1F5A25] text-white text-sm font-mono px-4 py-2.5 rounded-2xl rounded-br-md shadow">
        31500 200
      </motion.div>
      <motion.div variants={rise} className="bg-white text-[13px] text-gray-800 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm leading-relaxed">
        ✅ Принято: 31 500 ₽/т · 200 т<br />
        <span className="text-gray-500">Цена изменится — пришлите новую.</span>
      </motion.div>
    </motion.div>
  );
}

function ExporterMockup() {
  const { latest } = useMarket();
  const s = computeIndex([...latest.values()].filter((q) => REGION_BY_ID[q.regionId].directions.includes("china")));
  const base = s?.index ?? 30500;
  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
      <motion.div variants={rise} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2.5 text-[13px]">
        {[
          ["Котировка · Китай", `${rub(base)} ₽/т`, true],
          ["Доставка до границы", "по расчёту", false],
          ["Выкуп и документы", "берём на себя", false],
        ].map(([label, value, strong]) => (
          <div key={String(label)} className="flex justify-between gap-3">
            <span className="text-gray-500">{label}</span>
            <span className={"whitespace-nowrap tabular-nums " + (strong ? "font-bold text-[#111]" : "text-gray-700")}>{value}</span>
          </div>
        ))}
        <div className="h-px bg-gray-100" />
        <div className="flex justify-between gap-3">
          <span className="font-semibold text-[#111]">Цена на вашем базисе</span>
          <span className="font-bold text-[#1F5A25] whitespace-nowrap">в КП</span>
        </div>
      </motion.div>
      <motion.div variants={rise} className="flex items-center gap-2 px-1 text-[11px] font-semibold text-[#111]">
        <CheckCircle2 className="w-4 h-4 text-[#1F5A25]" /> Один договор · одна точка контакта
      </motion.div>
    </motion.div>
  );
}

function AgentMockup() {
  const nodes = [
    { icon: <BarChart3 />, label: "Котировка" },
    { icon: <FileSignature />, label: "Договор" },
    { icon: <Handshake />, label: "Сделка" },
  ];
  return (
    <div className="space-y-5">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="flex items-center justify-around py-3 relative">
        <div className="absolute top-[34%] left-[12%] right-[12%] h-px bg-gray-200" />
        {nodes.map((n, i) => (
          <motion.div key={i} variants={rise} className="relative z-10 flex flex-col items-center gap-2">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center border-2 bg-white border-[#1F5A25] text-[#1F5A25] shadow-md">
              {React.cloneElement(n.icon as React.ReactElement<{ className?: string }>, { className: "w-4 h-4" })}
            </div>
            <span className="text-[10px] font-bold text-[#333]">{n.label}</span>
          </motion.div>
        ))}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#111]">Вознаграждение</span>
          <span className="text-[10px] font-bold text-[#1F5A25] bg-[#8CC152]/15 px-2 py-0.5 rounded">% от сделки</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">Фиксируется в агентском договоре до начала работы.</p>
      </motion.div>
    </div>
  );
}

function ReadingMockup() {
  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-4">
      <motion.div variants={rise} className="bg-[#0d2410] p-5 rounded-2xl text-white shadow-xl">
        <p className="text-[10px] uppercase tracking-widest text-[#A6D86C] font-bold mb-2">Индекс · медиана</p>
        <p className="text-3xl font-bold tabular-nums">31 450 <span className="text-base text-white/50">₽/т</span></p>
        <div className="relative h-2 bg-white/10 rounded-full mt-4">
          <div className="absolute h-full rounded-full bg-[#A6D86C]/40" style={{ left: "30%", width: "38%" }} />
          <div className="absolute -top-1 h-4 w-1 rounded-full bg-[#A6D86C]" style={{ left: "47%" }} />
        </div>
        <div className="flex justify-between text-[10px] text-white/50 mt-2">
          <span>мин</span>
          <span>ядро рынка</span>
          <span>макс</span>
        </div>
      </motion.div>
      <motion.div variants={rise} className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-lg font-black text-[#111]">EXW</p>
          <p className="text-[10px] font-bold text-[#888] uppercase">склад предприятия</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-lg font-black text-[#111]">с НДС</p>
          <p className="text-[10px] font-bold text-[#888] uppercase">₽ за тонну</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function HowItWorks({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState(0);
  const step = steps[activeTab];

  const renderMockup = () => {
    switch (step.id) {
      case "producer":
        return <ProducerMockup />;
      case "exporter":
        return <ExporterMockup />;
      case "agent":
        return <AgentMockup />;
      case "reading":
        return <ReadingMockup />;
    }
  };

  return (
    <motion.section
      id="instrukciya"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className={"bg-white py-20 md:py-24 px-4 md:px-20 font-sans overflow-hidden scroll-mt-10 " + (className || "")}
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-medium text-[34px] md:text-[48px] text-[#111011] leading-tight mb-4 tracking-tight">Инструкция</h2>
          <p className="text-[16px] text-[#6f7a6a] max-w-[520px] mx-auto leading-relaxed">
            Кто и как пользуется инструментом. Выберите свою роль.
          </p>
        </div>

        <div className="bg-[#ebefe5] rounded-t-[24px] md:rounded-t-[32px] flex flex-row overflow-x-auto no-scrollbar border-x border-t border-[#dfe5d7] p-2">
          {steps.map((s, index) => (
            <motion.button
              key={s.id}
              onClick={() => setActiveTab(index)}
              whileHover={{ scale: 1.02 }}
              className={
                "flex-1 min-w-[170px] md:min-w-0 py-3.5 md:py-4 px-4 md:px-6 flex items-center justify-center gap-3 transition-all duration-500 relative rounded-[18px] md:rounded-[22px] group outline-none border " +
                (activeTab === index ? "bg-white border-gray-100 text-[#111]" : "border-transparent text-[#6b7266] hover:text-[#333] hover:bg-white/50")
              }
            >
              <div
                className={
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 " +
                  (activeTab === index
                    ? "bg-[#1F5A25] text-white shadow-[0_8px_20px_-4px_rgba(31,90,37,0.45)]"
                    : "bg-white border border-gray-200 text-[#888] group-hover:border-[#1F5A25]/30 group-hover:text-[#1F5A25]")
                }
              >
                {s.tabIcon}
              </div>
              <span className={"text-[15px] whitespace-nowrap tracking-tight transition-all duration-300 " + (activeTab === index ? "font-bold" : "font-medium")}>
                {s.tabLabel}
              </span>
            </motion.button>
          ))}
        </div>

        <div className="bg-white rounded-b-[24px] md:rounded-b-[32px] border-x border-b border-[#e6e9e1] min-h-[520px] p-6 md:p-16 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
              className="grid lg:grid-cols-[46%_54%] gap-10 md:gap-14 items-center"
            >
              <div className="flex flex-col gap-7">
                <div>
                  <span className="inline-block border border-[#1F5A25]/20 rounded-full px-4 py-1 text-[11px] font-bold tracking-[2px] text-[#1F5A25] bg-[#8CC152]/10 mb-4 uppercase">
                    {step.badge}
                  </span>
                  <h3 className="font-medium text-[28px] md:text-[38px] text-[#111011] leading-[1.2] mt-2 tracking-tight">{step.heading}</h3>
                </div>

                <ol className="space-y-3.5 max-w-[470px]">
                  {step.steps.map((t, i) => (
                    <li key={i} className="flex gap-3.5 text-[15px] text-[#555d52] leading-[1.6]">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-[#1F5A25]/8 border border-[#1F5A25]/20 text-[#1F5A25] text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>

                <div>
                  <button
                    onClick={() => {
                      if (step.cta.role) openLead(step.cta.role);
                      else if (step.cta.href) document.querySelector(step.cta.href)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="relative overflow-hidden bg-[#111] text-white rounded-2xl px-8 md:px-10 py-4 md:py-5 text-[16px] font-bold flex items-center gap-3 hover:bg-[#1F5A25] transition-all duration-500 group"
                  >
                    <span className="relative z-10">{step.cta.label}</span>
                    <div className="relative z-10 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                    <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:left-full transition-all duration-1000 ease-in-out" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-[600px] aspect-[4/3] bg-[#f6f8f2] rounded-[32px] md:rounded-[48px] p-6 md:p-14 flex items-center justify-center overflow-hidden group border border-gray-100">
                  <div className="absolute inset-0 z-0">
                    <img
                      src={asset(step.image)}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Статичная карточка: без бесконечной анимации поверх размытия — это главный источник подтормаживаний */}
                  <div className="w-full max-w-[380px] relative z-10 bg-white/85 border border-white rounded-[24px] md:rounded-[32px] p-5 md:p-7 shadow-[0_30px_60px_rgba(0,0,0,0.12)]">
                    {renderMockup()}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
}
