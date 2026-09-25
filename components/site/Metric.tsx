"use client";

import React from "react";
import { motion } from "framer-motion";
import { useMarket } from "@/components/market/MarketProvider";
import { computeIndex } from "@/lib/market/aggregate";
import { REGIONS } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";
import { asset } from "@/lib/config";

function MiniBarChart({ heights, litCount }: { heights: number[]; litCount: number }) {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-colors duration-500"
          style={{ height: h + "%", backgroundColor: i < litCount ? "#8CC152" : "#e5e7eb" }}
        />
      ))}
    </div>
  );
}

export default function Metric({ className }: { className?: string }) {
  const { ready, companies, latest, today } = useMarket();
  const s = computeIndex([...latest.values()]);
  const regionsActive = new Set([...latest.values()].map((q) => q.regionId)).size;

  const stats = [
    { index: "001", value: ready ? String(companies.length) : "—", label: "Предприятий в базе", barHeights: [40, 60, 30, 80], litCount: 1 },
    { index: "002", value: ready ? String(latest.size) : "—", label: "Подали цену сегодня", barHeights: [30, 50, 80, 40], litCount: 2 },
    { index: "003", value: s ? rub(s.volume) : "—", label: "Тонн свободно к отгрузке", barHeights: [20, 40, 60, 90], litCount: 3 },
    {
      index: "004",
      value: ready ? `${regionsActive}/${REGIONS.length}` : "—",
      label: `Регионов · ${today.filter((q) => q.status === "accepted").length} обновлений`,
      barHeights: [30, 50, 70, 100],
      litCount: 4,
    },
  ];

  return (
    <section className={"w-full bg-white pt-4 pb-20 font-sans " + (className || "")}>
      <div className="max-w-7xl mx-auto px-4 md:px-16 lg:px-20 mb-12 md:mb-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-[40px] md:text-6xl font-bold text-black leading-tight tracking-tight"
        >
          Рынок льна.
          <br />
          На сегодня.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm md:text-base text-gray-500 max-w-xs md:text-right leading-relaxed"
        >
          Цифры пересчитываются вместе с котировкой — по мере того, как предприятия присылают цены в бот.
        </motion.p>
      </div>

      <div className="relative w-full overflow-hidden">
        <div className="relative min-h-[400px] md:h-[450px] w-full py-10 md:py-0">
          <img src={asset("/media/field-wide.jpg")} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative md:absolute md:inset-0 flex items-center justify-center px-4 md:px-16 lg:px-20 h-full">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="bg-white w-full max-w-7xl rounded-[16px] shadow-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100"
            >
              {stats.map((stat) => (
                <div key={stat.index} className="px-7 md:px-8 py-9 md:py-12 flex flex-col justify-between min-h-[190px] md:min-h-[220px]">
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-xs font-medium text-gray-400 tracking-widest">{stat.index}</span>
                    <MiniBarChart heights={stat.barHeights} litCount={stat.litCount} />
                  </div>
                  <div>
                    <div className="text-5xl md:text-6xl font-bold text-black mb-4 tracking-tighter tabular-nums">{stat.value}</div>
                    <div className="text-[10px] font-bold text-gray-400 tracking-[0.15em] leading-tight uppercase">{stat.label}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
