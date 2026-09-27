"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { CROPS, CROP_BY_ID } from "@/lib/market/crops";
import { rub } from "@/lib/market/format";
import { asset } from "@/lib/config";
import SiteHeader, { openRequest } from "./SiteHeader";

/** Первый экран: заголовок по центру и белая сводка — сколько объёма доступно сегодня по каждой культуре */
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
      {/* Фото: поле на рассвете и элеватор; ровное затемнение под центрированный текст */}
      <div aria-hidden className="absolute inset-0">
        <img src={asset("/photos/hero.webp")} alt="" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-[#07160a]/70" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#07160a]/90 to-transparent" />
      </div>
      <div className="relative">
        <SiteHeader active="quotes" transparent />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-14 md:pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-[34px] sm:text-[44px] md:text-[56px] font-semibold leading-[1.05] tracking-[-0.02em] text-balance">Проверенные объёмы от предприятий&nbsp;— каждое утро</h1>
          <p className="mt-5 text-[17px] md:text-lg text-white/75 max-w-2xl mx-auto leading-relaxed text-pretty">
            Предприятия-партнёры ежедневно присылают нам цену, объём и качество продукции. Мы публикуем сводку по регионам, а сделку ведём сами — от проверки партии до отгрузки.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <a href="#terminal" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-[#0b1f0e] px-6 py-3.5 text-[15px] font-semibold hover:bg-white/90 transition-colors">
              Смотреть сводку <ArrowRight size={17} />
            </a>
            <button onClick={openRequest} className="inline-flex items-center justify-center rounded-lg border border-white/30 bg-white/5 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/10 transition-colors">
              Оставить заявку
            </button>
          </div>
          <p className="mt-6 text-[13px] text-white/55">
            {CROPS.length} культур · обновление в 8:00 по местному времени · все партнёры проходят проверку
          </p>
        </div>

        {/* Белая сводка: свободный объём по России по каждой культуре */}
        <div className="mt-12 md:mt-14 rounded-2xl bg-white text-gray-900 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] p-5 md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Доступно сегодня по России</p>
              <p className="text-sm text-gray-500">Свободный объём в предложениях партнёров</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-[#2f7a1f]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4f9a2a] agr-pulse" /> онлайн
              </span>
              <span className="text-sm text-gray-500">
                Всего <b className="text-gray-900 tabular-nums">{rub(total)} т</b>
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {rows.map((r) => (
              <button
                key={r.crop}
                onClick={() => openCrop(r.crop)}
                className="text-left rounded-xl border border-gray-200 px-4 py-3.5 hover:border-[#1F5A25]/40 hover:bg-[#f6f9f3] transition-colors"
              >
                <p className="text-sm text-gray-600">{CROP_BY_ID[r.crop].name}</p>
                <p className={"mt-1 text-xl font-semibold tabular-nums " + (r.volume ? "text-gray-900" : "text-gray-300")}>{r.volume ? `${rub(r.volume)} т` : "—"}</p>
                <p className="mt-0.5 text-xs text-gray-400 tabular-nums">
                  {r.volume ? (
                    <>
                      {r.count} предл.
                      {r.index && (
                        <>
                          <span className="hidden sm:inline"> · </span>
                          <span className="block sm:inline">{rub(r.index)} ₽/т</span>
                        </>
                      )}
                    </>
                  ) : (
                    "нет предложений"
                  )}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 text-center">
            <a href="#terminal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F5A25] hover:text-[#174a1c]">
              Смотреть все предложения <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
