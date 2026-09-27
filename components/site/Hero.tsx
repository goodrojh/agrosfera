"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { CROPS, CROP_BY_ID } from "@/lib/market/crops";
import { rub } from "@/lib/market/format";
import { asset } from "@/lib/config";
import SiteHeader, { openRequest } from "./SiteHeader";

/** Первый экран: кто мы и сколько объёма доступно сегодня по каждой культуре */
export default function Hero() {
  const { summary, setCrop } = useMarket();
  const rows = [...summary].sort((a, b) => b.volume - a.volume);
  const total = summary.reduce((s, r) => s + r.volume, 0);

  const openCrop = (id: (typeof CROPS)[number]["id"]) => {
    setCrop(id);
    document.getElementById("terminal")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative bg-[#07160a] text-white overflow-hidden">
      {/* Фото: поле на рассвете и элеватор; затемнение слева — под текст */}
      <div aria-hidden className="absolute inset-0">
        <img src={asset("/photos/hero.webp")} alt="" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07160a]/95 via-[#07160a]/75 to-[#07160a]/35" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#07160a]/80 to-transparent" />
      </div>
      <div className="relative">
        <SiteHeader active="quotes" transparent />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-14 md:py-24 grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
        <div>
          <h1 className="text-[36px] sm:text-[46px] md:text-[54px] font-semibold leading-[1.06] tracking-[-0.02em]">Проверенные объёмы от предприятий — каждое утро</h1>
          <p className="mt-6 text-[17px] md:text-lg text-white/75 max-w-xl leading-relaxed">
            Предприятия-партнёры ежедневно присылают нам цену, объём и качество продукции. Мы публикуем сводку по регионам, а сделку ведём сами — от проверки партии до отгрузки.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="#terminal" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-[#0b1f0e] px-6 py-3.5 text-[15px] font-semibold hover:bg-white/90 transition-colors">
              Смотреть сводку <ArrowRight size={17} />
            </a>
            <button onClick={openRequest} className="inline-flex items-center justify-center rounded-lg border border-white/30 bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/10 transition-colors">
              Оставить заявку
            </button>
          </div>
          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/15 pt-6 max-w-xl">
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

        {/* Сколько доступно сегодня по России по каждой культуре */}
        <div className="rounded-2xl border border-white/15 bg-[#07160a]/70 backdrop-blur-sm p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Доступно сегодня по России</p>
            <span className="inline-flex items-center gap-2 text-xs text-[#8CC152]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8CC152] agr-pulse" /> онлайн
            </span>
          </div>
          <p className="mt-0.5 text-xs text-white/50">Свободный объём в предложениях партнёров</p>
          <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {(rows.length ? rows : CROPS.map((c) => ({ crop: c.id, volume: 0, count: 0, index: null }))).map((r) => (
              <button key={r.crop} onClick={() => openCrop(r.crop)} className="w-full flex items-center justify-between gap-4 py-2.5 text-sm text-left hover:bg-white/5 -mx-2 px-2 rounded-md transition-colors">
                <span className="text-white/85 whitespace-nowrap">{CROP_BY_ID[r.crop].name}</span>
                {r.volume ? (
                  <span className="tabular-nums">
                    <b className="font-semibold">{rub(r.volume)} т</b>
                    <span className="ml-2 text-xs text-white/45 hidden sm:inline">
                      {r.count} предл.{r.index ? ` · ${rub(r.index)} ₽/т` : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-white/35">—</span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-white/60">
              Всего: <b className="text-white tabular-nums">{rub(total)} т</b>
            </span>
            <a href="#terminal" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
              Смотреть сводку <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
