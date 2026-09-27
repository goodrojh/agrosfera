"use client";

import React, { useMemo } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { computeIndex, dailySeries } from "@/lib/market/aggregate";
import { CROPS, CROP_BY_ID } from "@/lib/market/crops";
import { pct, rub, tons } from "@/lib/market/format";
import SiteHeader, { openRequest } from "./SiteHeader";

/** Первый экран: кто мы и живая сводка по рынку */
export default function Hero() {
  const { ready, offers, history, recent, crop, now: nowTs } = useMarket();

  const board = useMemo(() => {
    if (!ready) return null;
    const now = computeIndex(offers);
    const days = dailySeries(history, recent, { regions: [] }, 2, nowTs);
    const prev = days.length >= 2 ? days[days.length - 2] : null;
    return {
      index: now?.index ?? null,
      change: now && prev ? now.index / prev.index - 1 : null,
      best: offers.length ? Math.min(...offers.map((q) => q.price)) : null,
      volume: offers.reduce((s, q) => s + q.volume, 0),
      count: offers.length,
      regions: new Set(offers.map((q) => q.regionId)).size,
    };
  }, [ready, offers, history, recent, nowTs]);

  const rows: [string, string][] = board
    ? [
        ["Предложений в сводке", String(board.count)],
        ["Свободный объём", board.volume ? tons(board.volume) : "—"],
        ["Регионов", String(board.regions)],
        ["Лучшая цена", board.best ? `${rub(board.best)} ₽/т` : "—"],
      ]
    : [];

  return (
    <section className="relative bg-[#07160a] text-white overflow-hidden">
      {/* Тонкая сетка — строгий фон */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(to bottom, black, transparent 90%)",
        }}
      />
      <SiteHeader active="quotes" />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-14 md:py-24 grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center">
        <div>
          <p className="text-[13px] uppercase tracking-[0.2em] text-[#8CC152] font-medium">Агроброкер АгроСфера</p>
          <h1 className="mt-4 text-[36px] sm:text-[46px] md:text-[54px] font-semibold leading-[1.06] tracking-[-0.02em]">Проверенные объёмы от предприятий — каждое утро</h1>
          <p className="mt-6 text-[17px] md:text-lg text-white/70 max-w-xl leading-relaxed">
            Предприятия-партнёры ежедневно присылают нам цену, объём и качество продукции. Мы публикуем сводку по регионам, а сделку ведём сами — от проверки партии до отгрузки.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="#terminal" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-[#0b1f0e] px-6 py-3.5 text-[15px] font-semibold hover:bg-white/90 transition-colors">
              Смотреть сводку <ArrowRight size={17} />
            </a>
            <button onClick={openRequest} className="inline-flex items-center justify-center rounded-lg border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/10 transition-colors">
              Оставить заявку
            </button>
          </div>
          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 max-w-xl">
            {[
              [String(CROPS.length), "культур"],
              ["8:00", "обновление по местному времени"],
              ["100%", "партнёров проверены"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="text-xl md:text-2xl font-semibold tabular-nums">{v}</dt>
                <dd className="mt-1 text-[13px] text-white/50">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Сводка по выбранной культуре */}
        <a href="#terminal" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-7 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/60">{CROP_BY_ID[crop].name} · сводка сегодня</p>
            <span className="inline-flex items-center gap-2 text-xs text-[#8CC152]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8CC152] agr-pulse" /> онлайн
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <span className="text-[40px] md:text-[44px] font-semibold tabular-nums leading-none">{board?.index ? rub(board.index) : "—"}</span>
            <span className="text-white/50">₽/т</span>
            {board?.change != null && (
              <span className={"inline-flex items-center text-sm font-semibold tabular-nums " + (board.change >= 0 ? "text-[#8CC152]" : "text-[#f08a73]")}>
                {board.change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {pct(board.change)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-white/40">средняя цена предложений, с НДС, со склада</p>
          <dl className="mt-6 divide-y divide-white/10 border-t border-white/10">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-white/55">{k}</dt>
                <dd className="font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 inline-flex items-center gap-1.5 text-sm text-white/70">
            Смотреть сводку <ArrowRight size={15} />
          </p>
        </a>
      </div>
    </section>
  );
}
