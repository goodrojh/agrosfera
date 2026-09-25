"use client";

import React, { memo, useMemo, useState } from "react";
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

const Row = memo(function Row({ l, best, inFill, maxLevel }: { l: Level; best: boolean; inFill: boolean; maxLevel: number }) {
  const regions =
    l.regions
      .slice(0, 2)
      .map((r) => shortRegionName(r.id))
      .join(", ") + (l.regions.length > 2 ? ` +${l.regions.length - 2}` : "");
  return (
    <div
      title={l.regions.map((r) => `${shortRegionName(r.id)}: ${rub(r.volume)} т`).join("\n")}
      className={"relative grid grid-cols-[1.3fr_1.3fr_0.5fr_0.9fr] gap-3 items-center px-3 py-2.5 rounded-lg " + (inFill ? "bg-[#8CC152]/12" : "")}
    >
      {/* Вспышка при изменении уровня: новый key перезапускает CSS-анимацию */}
      <span key={`${l.volume}-${l.count}`} className="agr-flash absolute inset-0 rounded-lg" />
      <span className="relative min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold tabular-nums text-[#1F5A25]">{rub(l.price)}</span>
          {best && <span className="text-[10px] rounded bg-[#1F5A25] text-white px-1.5 py-px">лучшая</span>}
        </span>
        <span className="block text-[11px] text-gray-400 truncate">{regions}</span>
      </span>
      <span className="relative text-right text-sm font-semibold tabular-nums text-gray-900 py-1">
        <span
          className="absolute right-0 top-0 bottom-0 rounded-md bg-[#8CC152]/25 transition-[width] duration-500"
          style={{ width: `${Math.max(8, (l.volume / maxLevel) * 100)}%` }}
        />
        <span className="relative pr-1.5">{rub(l.volume)} т</span>
      </span>
      <span className="relative text-right text-sm tabular-nums text-gray-500">{l.count}</span>
      <span className="relative text-right text-sm tabular-nums text-gray-500">{rub(l.cumulative)}</span>
    </div>
  );
});

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
    <div className="flex flex-col">
      {/* Управление: одна строка */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Нужно
          <input
            value={need}
            onChange={(e) => setNeed(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="1000"
            className="w-24 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm tabular-nums text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40"
          />
          т
          <span className="hidden sm:flex gap-1 ml-1">
            {NEED_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setNeed(need === String(p) ? "" : String(p))}
                className={
                  "text-xs rounded-md px-2 py-1 transition-colors tabular-nums " +
                  (need === String(p) ? "bg-[#1F5A25] text-white" : "text-gray-500 hover:bg-gray-100")
                }
              >
                {rub(p)}
              </button>
            ))}
          </span>
        </label>
        <div className="flex bg-gray-100 p-1 rounded-lg" role="group" aria-label="Шаг цены">
          {STEPS.map((s) => (
            <button
              key={s.v}
              onClick={() => setStep(s.v)}
              className={
                "px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors " +
                (step === s.v ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {fill && (
        <p className={"mt-3 rounded-xl px-4 py-3 text-sm leading-snug " + (fill.enough ? "bg-[#f3f8ee] text-gray-700" : "bg-[#fdf1ee] text-[#a8402a]")}>
          {fill.enough ? (
            <>
              <b className="text-gray-900 tabular-nums">{tons(fill.need)}</b> соберём по средней цене{" "}
              <b className="text-gray-900 tabular-nums">{rub(fill.avg)} ₽/т</b> — у {fill.companies} предпр., максимум{" "}
              <span className="tabular-nums">{rub(fill.maxPrice)} ₽/т</span>
            </>
          ) : (
            <>
              Сейчас в продаже только <b className="tabular-nums">{tons(fill.filled)}</b>. Оставьте заявку — соберём остальное.
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-[1.3fr_1.3fr_0.5fr_0.9fr] gap-3 px-3 pt-5 pb-2 text-xs text-gray-400">
        <span>{step ? "Цена от, ₽/т" : "Цена, ₽/т"}</span>
        <span className="text-right">Объём</span>
        <span className="text-right">Предпр.</span>
        <span className="text-right">Накоплено</span>
      </div>
      <div className="overflow-y-auto max-h-[440px] agr-scroll">
        {levels.map((l, i) => (
          <Row key={l.price} l={l} best={i === 0} inFill={!!fill && l.price <= fill.maxPrice} maxLevel={maxLevel} />
        ))}
        {levels.length === 0 && <p className="text-sm text-gray-400 px-3 py-10 text-center">Сегодня предложений пока нет</p>}
      </div>
      <div className="flex justify-between border-t border-gray-100 mt-3 pt-3 px-3 text-sm text-gray-500">
        <span>Всего в продаже</span>
        <span className="font-semibold text-gray-800 tabular-nums">
          {tons(total)} · {quotes.length} предпр.
        </span>
      </div>
    </div>
  );
}
