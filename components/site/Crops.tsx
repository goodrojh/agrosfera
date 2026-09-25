"use client";

import React from "react";
import { motion } from "framer-motion";
import { Bean, Flower2, Leaf, Nut, Sprout, Sun, Wheat } from "lucide-react";

const CROPS = [
  { name: "Лён масличный", note: "Котировки в реальном времени", icon: Sprout, live: true },
  { name: "Подсолнечник", note: "Цены производителей и маслозаводов", icon: Sun },
  { name: "Рапс", note: "Яровой и озимый, по регионам", icon: Flower2 },
  { name: "Соя", note: "Дальний Восток и Центр", icon: Bean },
  { name: "Горчица", note: "Поволжье и Юг", icon: Leaf },
  { name: "Пшеница", note: "По классам и направлениям", icon: Wheat },
  { name: "Ячмень", note: "Фуражный и пивоваренный", icon: Wheat },
  { name: "Нут и горох", note: "Экспортные бобовые", icon: Nut },
];

export default function Crops({ className }: { className?: string }) {
  return (
    <section className={"bg-[#f6f8f2] py-20 px-4 md:px-[60px] font-sans " + (className || "")}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8 mb-10 md:mb-12">
          <div className="w-full md:w-[60%]">
            <h2 className="text-[#111110] font-semibold text-[32px] md:text-[48px] leading-[1.1] mb-4 tracking-tight">
              Дальше — все культуры агросектора
            </h2>
            <p className="text-[#666d63] text-[15px] leading-[1.65] max-w-[480px]">
              Та же механика — цена от производителя, проверка, медиана — для каждой культуры. Прозрачный рынок в одном окне.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CROPS.map((c, index) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className={
                "rounded-[16px] p-7 flex flex-col transition-all duration-300 group cursor-default border " +
                (c.live ? "bg-[#1F5A25] border-[#1F5A25] text-white" : "bg-white border-[#eaede6] hover:border-[#8CC152] hover:shadow-xl")
              }
            >
              <div className="flex items-center justify-between mb-7">
                <div className={"w-[52px] h-[52px] rounded-[12px] flex items-center justify-center " + (c.live ? "bg-white/15" : "bg-[#f1f5ec]")}>
                  <c.icon className={"w-6 h-6 " + (c.live ? "text-[#C3E79A]" : "text-[#1F5A25]")} />
                </div>
                <span
                  className={
                    "text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 " +
                    (c.live ? "bg-[#A6D86C] text-[#0d2410]" : "bg-[#f1f5ec] text-[#7d8778]")
                  }
                >
                  {c.live ? "работает" : "в планах"}
                </span>
              </div>
              <h3 className={"font-bold text-lg mb-2 " + (c.live ? "text-white" : "text-[#111110]")}>{c.name}</h3>
              <p className={"text-sm leading-[1.6] " + (c.live ? "text-white/75" : "text-[#666d63]")}>{c.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
