"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { shortRegionName, type RegionId } from "@/lib/market/regions";
import { rub, tons } from "@/lib/market/format";
import type { Quote } from "@/lib/market/types";

const STEPS = [
  { v: 0, label: "Точно" },
  { v: 250, label: "250 ₽" },
  { v: 500, label: "500 ₽" },
  { v: 1000, label: "1 000 ₽" },
];
const NEED_PRESETS = [500, 1000, 3000];

interface Level {
  price: number;
  volume: number;
  count: number;
  cumulative: number;
  regions: { id: RegionId; volume: number }[];
}

/** Стакан предложений: сколько тонн продают по каждой цене */
export default function OrderBook({ quotes }: { quotes: Quote[] }) {
  const [step, setStep] = useState(250);
  const [need, setNeed] = useState("");

  const levels = useMemo<Level[]>(() => {
    const map = new Map<number, { volume: number; count: number; regions: Map<RegionId, number> }>();
    for (const q of quotes) {
      const key = step ? Math.floor(q.price / step) * step : q.price;
      let l = map.get(key);
      if (!l) map.set(key, (l = { volume: 0, count: 0, regions: new Map() }));
      l.volume += q.volume;
      l.count += 1;
      l.regions.set(q.regionId, (l.regions.get(q.regionId) ?? 0) + q.volume);
    }
    const out: Level[] = [];
    let cum = 0;
    for (const [price, l] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
      cum += l.volume;
      out.push({
        price,
        volume: l.volume,
        count: l.count,
        cumulative: cum,
        regions: [...l.regions.entries()].map(([id, volume]) => ({ id, volume })).sort((a, b) => b.volume - a.volume),
      });
    }
    return out;
  }, [quotes, step]);

  const total = levels.length ? levels[levels.length - 1].cumulative : 0;
  const maxLevel = Math.max(1, ...levels.map((l) => l.volume));

  // Сколько стоит собрать нужный объём, покупая от самых дешёвых предложений
  const fill = useMemo(() => {
    const n = Number(need);
    if (!n) return null;
    const sorted = [...quotes].sort((a, b) => a.price - b.price || b.volume - a.volume);
    let left = n;
    let cost = 0;
    let maxPrice = 0;
    let companies = 0;
    for (const q of sorted) {
      if (left <= 0) break;
      const take = Math.min(left, q.volume);
      cost += take * q.price;
      left -= take;
      maxPrice = q.price;
      companies += 1;
    }
    const filled = n - Math.max(0, left);
    return { need: n, filled, enough: left <= 0, avg: filled ? cost / filled : 0, maxPrice, companies };
  }, [need, quotes]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            Стакан предложений
            <span className="w-2 h-2 rounded-full bg-[#4f9a2a] agr-pulse" />
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Сколько тонн продают по каждой цене. Сверху — самые дешёвые.</p>
        </div>
      </div>

      {/* Управление */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <div className="flex bg-gray-100 p-1 rounded-lg" role="group" aria-label="Шаг цены">
          {STEPS.map((s) => (
            <button
              key={s.v}
              onClick={() => setStep(s.v)}
              className={
                "px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-all " +
                (step === s.v ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[#f6f8f2] border border-[#e6ebe1] p-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="shrink-0">Нужно</span>
          <input
            value={need}
            onChange={(e) => setNeed(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="1000"
            className="w-24 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm tabular-nums text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40"
          />
          <span className="shrink-0">т</span>
          <span className="flex gap-1 ml-auto">
            {NEED_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setNeed(String(p))}
                className={
                  "text-[11px] rounded-md px-1.5 py-1 border transition-colors tabular-nums " +
                  (need === String(p) ? "border-[#1F5A25] text-[#1F5A25] bg-white" : "border-gray-200 text-gray-500 hover:text-gray-800 bg-white")
                }
              >
                {rub(p)}
              </button>
            ))}
          </span>
        </label>
        {fill && (
          <p className="text-[13px] mt-2 leading-snug">
            {fill.enough ? (
              <>
                <span className="text-gray-900 font-semibold tabular-nums">{tons(fill.need)}</span>
                <span className="text-gray-600"> — средняя </span>
                <span className="text-gray-900 font-semibold tabular-nums">{rub(fill.avg)} ₽/т</span>
                <span className="text-gray-600">, цены до </span>
                <span className="text-gray-900 font-semibold tabular-nums">{rub(fill.maxPrice)}</span>
                <span className="text-gray-600"> · у {fill.companies} предпр.</span>
              </>
            ) : (
              <span className="text-[#c0492f]">
                Сейчас доступно только {tons(fill.filled)} (средняя {rub(fill.avg)} ₽/т). Оставьте заявку — соберём остальное.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Таблица */}
      <div className="grid grid-cols-[1.25fr_1.3fr_0.55fr_0.9fr] gap-2 px-2 pt-4 pb-2 text-[11px] text-gray-400">
        <span>{step ? "Цена от, ₽/т" : "Цена, ₽/т"}</span>
        <span className="text-right">Объём</span>
        <span className="text-right">Предпр.</span>
        <span className="text-right">Накоплено</span>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar max-h-[330px] -mx-1 px-1">
        {levels.map((l, i) => {
          const inFill = fill && l.price <= fill.maxPrice;
          const regions = l.regions.slice(0, 2).map((r) => shortRegionName(r.id)).join(", ") + (l.regions.length > 2 ? ` +${l.regions.length - 2}` : "");
          return (
            <div
              key={l.price}
              title={l.regions.map((r) => `${shortRegionName(r.id)}: ${rub(r.volume)} т`).join("\n")}
              className={
                "relative grid grid-cols-[1.25fr_1.3fr_0.55fr_0.9fr] gap-2 items-center px-2 py-2 rounded-lg overflow-hidden " +
                (inFill ? "bg-[#8CC152]/12" : "")
              }
            >
              {/* Вспышка при изменении уровня */}
              <motion.span
                key={`${l.volume}-${l.count}`}
                className="absolute inset-0 rounded-lg"
                initial={{ backgroundColor: "rgba(140,193,82,0.35)" }}
                animate={{ backgroundColor: "rgba(140,193,82,0)" }}
                transition={{ duration: 1.4 }}
              />
              <span className="relative min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tabular-nums text-[#1F5A25]">
                    {rub(l.price)}
                  </span>
                  {i === 0 && <span className="text-[10px] rounded bg-[#1F5A25] text-white px-1 py-px">лучшая</span>}
                </span>
                <span className="block text-[11px] text-gray-400 truncate">{regions}</span>
              </span>
              {/* Объём с полосой глубины: чем длиннее, тем больше тонн на этой цене */}
              <span className="relative text-right text-sm font-semibold tabular-nums text-gray-900 py-1">
                <motion.span
                  className="absolute right-0 top-0 bottom-0 rounded-md bg-[#8CC152]/25"
                  animate={{ width: `${Math.max(8, (l.volume / maxLevel) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
                <span className="relative pr-1.5">{rub(l.volume)} т</span>
              </span>
              <span className="relative text-right text-sm tabular-nums text-gray-500">{l.count}</span>
              <span className="relative text-right text-sm tabular-nums text-gray-500">{rub(l.cumulative)}</span>
            </div>
          );
        })}
        {levels.length === 0 && <p className="text-sm text-gray-400 px-2 py-6">Сегодня предложений пока нет</p>}
      </div>
      <div className="flex justify-between border-t border-gray-100 mt-2 pt-3 px-2 text-xs text-gray-500">
        <span>Всего в стакане</span>
        <span className="font-semibold text-gray-800 tabular-nums">
          {tons(total)} · {quotes.length} предпр.
        </span>
      </div>
    </div>
  );
}
