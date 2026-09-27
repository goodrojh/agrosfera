"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { CROPS, CROP_BY_ID } from "@/lib/market/crops";
import { rub } from "@/lib/market/format";
import { asset } from "@/lib/config";
import SiteHeader, { openRequest } from "./SiteHeader";

/** Первый экран: текст слева, белая сводка объёмов по культурам справа — всё видно без прокрутки */
export default function Hero() {
  const { summary, setCrop } = useMarket();
  const rows = summary.length ? [...summary].sort((a, b) => b.volume - a.volume) : CROPS.map((c) => ({ crop: c.id, volume: 0, count: 0, index: null }));
  const total = summary.reduce((s, r) => s + r.volume, 0);

  const openCrop = (id: (typeof CROPS)[number]["id"]) => {
    setCrop(id);
    document.getElementById("terminal")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative bg-[#07160a] text-white overflow-hidden">
      {/* Фото: поле на рассвете и элеватор; слева темнее — под текст */}
      <div aria-hidden className="absolute inset-0">
        <img src={asset("/photos/hero.webp")} alt="" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07160a]/90 via-[#07160a]/70 to-[#07160a]/45" />
      </div>
      <div className="relative">
        <SiteHeader active="quotes" transparent />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-8 pb-12 md:pt-12 md:pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-start">
        {/* Текст */}
        <div>
          <h1 className="text-[34px] sm:text-[44px] lg:text-[52px] font-semibold leading-[1.06] tracking-[-0.02em] text-balance">Проверенные объёмы от предприятий&nbsp;— каждое утро</h1>
          <p className="mt-5 text-[17px] md:text-lg text-white/75 max-w-xl leading-relaxed text-pretty">
            Предприятия-партнёры ежедневно присылают нам цену, объём и качество продукции. Мы публикуем сводку по регионам, проводим сделку и доставляем груз в нужную экспортёру точку.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="#terminal" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-[#0b1f0e] px-6 py-3.5 text-[15px] font-semibold hover:bg-white/90 transition-colors">
              Смотреть сводку <ArrowRight size={17} />
            </a>
            <button onClick={openRequest} className="inline-flex items-center justify-center rounded-lg border border-white/30 bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/10 transition-colors">
              Оставить заявку
            </button>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-6 max-w-xl">
            {[
              [String(CROPS.length), "культур"],
              ["8:00", "обновление по местному времени"],
              ["100%", "партнёров проверены"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="text-xl md:text-2xl font-semibold tabular-nums">{v}</dt>
                <dd className="mt-1 text-[13px] text-white/60">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Белая сводка: свободный объём по России по каждой культуре */}
        <div className="lg:mt-2 rounded-2xl bg-white text-gray-900 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold leading-tight">Доступно сегодня по России</p>
              <p className="mt-0.5 text-sm text-gray-500">Свободный объём в предложениях партнёров</p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-2 text-xs font-medium text-[#2f7a1f] mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f9a2a] agr-pulse" /> онлайн
            </span>
          </div>

          <div className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
            {rows.map((r) => (
              <button
                key={r.crop}
                onClick={() => openCrop(r.crop)}
                className="w-full flex items-center justify-between gap-4 py-2.5 px-2 -mx-2 rounded-lg text-left hover:bg-[#f6f9f3] transition-colors"
              >
                <span className="text-[15px] text-gray-700 whitespace-nowrap">{CROP_BY_ID[r.crop].name}</span>
                <span className="flex items-baseline gap-3 tabular-nums">
                  <b className={"text-[15px] font-semibold " + (r.volume ? "text-gray-900" : "text-gray-300")}>{r.volume ? `${rub(r.volume)} т` : "—"}</b>
                  <span className="hidden sm:block w-[150px] text-right text-xs text-gray-400">
                    {r.volume ? `${r.count} предл.${r.index ? ` · ${rub(r.index)} ₽/т` : ""}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Всего <b className="text-gray-900 tabular-nums">{rub(total)} т</b>
            </span>
            <a href="#terminal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F5A25] hover:text-[#174a1c]">
              Все предложения <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
