"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { asset } from "@/lib/config";
import { openLead, type LeadRole } from "@/lib/lead";

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5">
    <path d="M7 7v6a4 4 0 0 0 4 4h9" />
    <path d="m17 14 3 3-3 3" />
  </svg>
);

const CARDS: {
  role: LeadRole;
  title: string;
  text: string;
  price: string;
  unit: string;
  features: string[];
  cta: string;
  dark?: boolean;
}[] = [
  {
    role: "producer",
    title: "Производителям",
    text: "Покажите свой объём покупателям, не тратя время на звонки и рассылки прайсов.",
    price: "0 ₽",
    unit: "подключение и подача цен",
    features: ["Цена — одним сообщением в бот", "Название предприятия скрыто", "Покупатели видят регион и объём", "Никаких обязательств продавать"],
    cta: "Подключить предприятие",
  },
  {
    role: "exporter",
    title: "Экспортёрам",
    text: "Выступаем агентом: выкупаем партию у производителей и доставляем до порта.",
    price: "Выкуп",
    unit: "+ доставка до порта",
    features: ["Выкуп по актуальной котировке", "Сбор объёма из нескольких хозяйств", "Доставка до порта или погранперехода", "Один договор и одна точка контакта"],
    cta: "Оставить заявку",
  },
  {
    role: "agent",
    title: "Агентам",
    text: "Работаете со своим покупателем — берите объём и цену из инструмента.",
    price: "% от сделки",
    unit: "агентский договор",
    features: ["Цены и объёмы по регионам", "Сведение с производителем", "Условия фиксируются в договоре", "Сопровождение до отгрузки"],
    cta: "Обсудить договор",
    dark: true,
  },
];

export default function Partners({ className }: { className?: string }) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
  };

  return (
    <section id="partneram" className={"w-full bg-white py-[80px] px-4 md:px-[60px] font-sans overflow-hidden scroll-mt-10 " + (className || "")}>
      <div className="max-w-[1200px] mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 md:mb-[56px] flex flex-col items-center"
        >
          <h2 className="font-sans font-semibold text-[34px] md:text-[48px] text-[#111010] leading-[1.15] mb-3 max-w-[800px]">Партнёрам</h2>
          <p className="text-[16px] text-[#7d8778] font-normal">Три роли — три понятные схемы работы</p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="w-full flex flex-col lg:flex-row gap-6 items-stretch"
        >
          {CARDS.map((c) => (
            <motion.div
              key={c.role}
              variants={itemVariants}
              className={
                "flex-1 rounded-[20px] p-7 md:p-8 relative overflow-hidden flex flex-col justify-between min-h-[480px] " +
                (c.dark ? "group" : "bg-[#f6f8f2] border border-black/5")
              }
            >
              {c.dark && (
                <>
                  <div
                    className="absolute inset-0 z-0"
                    style={{ backgroundImage: `url('${asset("/media/port.jpg")}')`, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                  <div className="absolute inset-0 bg-[#07160a]/75 z-0" />
                </>
              )}
              <div className="relative z-10">
                <h3 className={"font-medium text-[28px] mb-3 " + (c.dark ? "text-white" : "text-[#111010]")}>{c.title}</h3>
                <p className={"text-[14px] font-medium leading-[1.5] mb-6 " + (c.dark ? "text-white" : "text-[#111010] opacity-90")}>{c.text}</p>
                <div className="flex flex-wrap items-baseline gap-x-2 mb-6">
                  <span className={"font-medium text-[38px] md:text-[42px] tracking-tight " + (c.dark ? "text-white" : "text-[#111010]")}>{c.price}</span>
                  <span className={"text-[15px] font-normal " + (c.dark ? "text-white/80" : "text-[#888888]")}>{c.unit}</span>
                </div>
                <div className={"h-[1px] w-full mb-6 " + (c.dark ? "bg-white/30" : "bg-[#e0e3dc]")} />
                <ul className="space-y-[10px]">
                  {c.features.map((f) => (
                    <li key={f} className={"flex items-center gap-3 text-[15px] font-medium " + (c.dark ? "text-white" : "text-[#626b5e]")}>
                      <span className={"text-[10px] " + (c.dark ? "text-white/60" : "text-[#9aa394]")}>&#8226;</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-10">
                {!c.dark && <div className="absolute -bottom-4 left-4 right-4 h-8 bg-[#1F5A25] blur-xl opacity-25 rounded-full" />}
                <button
                  onClick={() => openLead(c.role)}
                  className="relative z-10 bg-[#1F5A25] hover:bg-[#174a1c] text-white rounded-[14px] py-[14px] px-7 text-[15px] font-bold flex items-center gap-2.5 transition-all duration-200"
                >
                  {c.cta}
                  <ArrowIcon />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
