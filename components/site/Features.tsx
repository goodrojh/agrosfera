"use client";

import React from "react";
import { motion } from "framer-motion";
import { EyeOff, MessageSquareText, RefreshCcw, ShieldCheck, Sigma } from "lucide-react";
import BotSimulator from "@/components/market/BotSimulator";
import { LIMITS } from "@/lib/market/validate";

function FeatureCard({
  title,
  description,
  icon: Icon,
  children,
  className = "",
  id,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={"relative p-6 md:p-8 group overflow-hidden flex flex-col scroll-mt-24 " + className}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#1F5A25] transition-colors duration-300">
            <Icon size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-[380px]">{description}</p>
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#8CC152]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </motion.div>
  );
}

const pctL = (x: number) => `±${Math.round(x * 100)}%`;

const RULES = [
  { input: "30 150", result: "30 → 30 000 ₽/т?", status: "Переспросим", color: "#E9C46A" },
  { input: "325000 150", result: "Лишний ноль → 32 500?", status: "Переспросим", color: "#E9C46A" },
  { input: `${pctL(LIMITS.soft)} от медианы`, result: "Просим подтвердить", status: "Подтверждение", color: "#8CC152" },
  { input: `${pctL(LIMITS.hard)} от медианы`, result: "Не входит в индекс до проверки", status: "Модератор", color: "#E07A5F" },
];

export default function Features({ className }: { className?: string }) {
  return (
    <section id="metodika" className={"bg-white py-20 md:py-24 px-4 md:px-12 font-sans overflow-hidden " + (className || "")}>
      <div className="max-w-7xl mx-auto relative">
        <div className="mb-12 md:mb-16 relative">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 items-end">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[34px] md:text-[48px] font-semibold text-gray-900 tracking-tight leading-[1.1]"
            >
              Честная котировка <br />
              без обзвона предприятий
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-base md:text-lg text-gray-500 leading-relaxed max-w-md"
            >
              Производители сами присылают цену и объём в бот. Система проверяет каждую цифру и считает индекс так, чтобы одна ошибка не сдвинула рынок.
            </motion.p>
          </div>
        </div>

        <div className="relative border border-gray-200 rounded-[24px] md:rounded-[32px] overflow-hidden bg-gray-50/30">
          <div className="grid grid-cols-1 md:grid-cols-4 md:min-h-[640px]">
            {/* Бот */}
            <FeatureCard
              id="bot"
              title="Цена — одним сообщением"
              description="Каждое утро сотрудник предприятия пишет в Telegram или MAX: цена за тонну и объём. Цена поменялась — пишет снова, котировка обновится."
              icon={MessageSquareText}
              className="md:col-span-2 md:row-span-2 border-b md:border-b-0 md:border-r border-gray-200"
            >
              <BotSimulator />
            </FeatureCard>

            {/* Защита */}
            <FeatureCard
              title="Защита от ошибок"
              description="Бот повторяет, что понял, и переспрашивает, если цифра выглядит как опечатка или сильно отличается от рынка."
              icon={ShieldCheck}
              className="md:col-span-2 border-b border-gray-200"
            >
              <div className="mt-1 flex flex-col gap-2.5">
                {RULES.map((item, i) => (
                  <motion.div
                    key={item.input}
                    initial={{ x: -20, opacity: 0 }}
                    whileInView={{ x: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-mono text-gray-800 shrink-0">{item.input}</span>
                      <span className="text-xs text-gray-500 truncate">{item.result}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">{item.status}</span>
                  </motion.div>
                ))}
              </div>
            </FeatureCard>

            {/* Медиана */}
            <FeatureCard
              title="Медиана, не среднее"
              description="Индекс — медиана цен. Выбросы за пределами ядра рынка в расчёт не попадают."
              icon={Sigma}
              className="border-b md:border-b-0 md:border-r border-gray-200"
            >
              <div className="mt-auto bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="relative h-10">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200" />
                  {[18, 26, 31, 35, 38, 42, 47, 53].map((x, i) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#8CC152]"
                      style={{ left: `${x}%` }}
                    />
                  ))}
                  <span className="absolute top-0 bottom-0 w-0.5 bg-[#1F5A25]" style={{ left: "36.5%" }} />
                  <motion.span
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.8 }}
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#E07A5F] ring-4 ring-[#E07A5F]/15"
                    style={{ left: "93%" }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-medium">
                  <span className="text-[#1F5A25]">медиана</span>
                  <span className="text-[#E07A5F]">выброс — исключён</span>
                </div>
              </div>
            </FeatureCard>

            {/* Анонимность + обновления */}
            <FeatureCard
              title="Анонимно и актуально"
              description="Наружу видны регион, цена и объём — без названия предприятия. В расчёте только последняя цена каждого."
              icon={EyeOff}
            >
              <div className="mt-auto space-y-2">
                {[
                  { t: "08:05", p: "31 500 ₽/т · 300 т", old: true },
                  { t: "11:40", p: "31 200 ₽/т · 220 т", old: false },
                ].map((r) => (
                  <div
                    key={r.t}
                    className={"flex items-center justify-between rounded-xl border px-3 py-2 text-xs " + (r.old ? "border-gray-100 text-gray-400 line-through" : "border-[#8CC152]/40 bg-[#8CC152]/10 text-gray-800")}
                  >
                    <span className="font-mono">{r.t}</span>
                    <span className="tabular-nums">{r.p}</span>
                    {!r.old && <RefreshCcw size={12} className="text-[#1F5A25]" />}
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 pt-1">П-0412 · Омская обл.</p>
              </div>
            </FeatureCard>
          </div>
        </div>
      </div>
    </section>
  );
}
