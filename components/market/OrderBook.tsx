"use client";

import React, { memo, useMemo } from "react";
import { shortRegionName, type RegionId } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";
import type { Bid, Quote } from "@/lib/market/types";

/** Сколько лучших цен показываем с каждой стороны — всё помещается без прокрутки */
const ROWS = 8;

interface Level {
  price: number;
  volume: number;
  count: number;
  own: boolean;
  regions: RegionId[];
}

function aggregate(items: { price: number; volume: number; own?: boolean; regions: RegionId[] }[], desc: boolean): Level[] {
  const map = new Map<number, Level>();
  for (const it of items) {
    let l = map.get(it.price);
    if (!l) map.set(it.price, (l = { price: it.price, volume: 0, count: 0, own: false, regions: [] }));
    l.volume += it.volume;
    l.count += 1;
    l.own ||= !!it.own;
    for (const r of it.regions) if (!l.regions.includes(r)) l.regions.push(r);
  }
  return [...map.values()].sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
}

const BidRow = memo(function BidRow({ l, max }: { l: Level; max: number }) {
  return (
    <div
      className="relative h-8 flex items-center justify-between px-3 rounded-md"
      title={l.regions.length ? `Готовы брать: ${l.regions.map(shortRegionName).join(", ")}` : "Готовы брать из любого региона"}
    >
      <span key={`${l.volume}-${l.count}`} className="agr-flash absolute inset-0 rounded-md" />
      <span
        className="absolute right-0 inset-y-0.5 rounded-md bg-[#2f7a1f]/10 transition-[width] duration-500"
        style={{ width: `${(l.volume / max) * 100}%` }}
      />
      <span className="relative flex items-center gap-1.5 text-[13px] tabular-nums text-gray-600">
        {rub(l.volume)} т{l.own && <span className="text-[10px] rounded bg-[#2f7a1f] text-white px-1 py-px">ваша</span>}
      </span>
      <span className="relative text-sm font-bold tabular-nums text-[#2f7a1f]">{rub(l.price)}</span>
    </div>
  );
});

const AskRow = memo(function AskRow({ l, max, onClick }: { l: Level; max: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative w-full h-8 flex items-center justify-between px-3 rounded-md hover:bg-gray-50 transition-colors"
      title={`${l.regions.map(shortRegionName).join(", ")} · нажмите, чтобы оставить заявку по этой цене`}
    >
      <span key={`${l.volume}-${l.count}`} className="agr-flash absolute inset-0 rounded-md" />
      <span
        className="absolute left-0 inset-y-0.5 rounded-md bg-[#c0492f]/10 transition-[width] duration-500"
        style={{ width: `${(l.volume / max) * 100}%` }}
      />
      <span className="relative text-sm font-bold tabular-nums text-[#c0492f]">{rub(l.price)}</span>
      <span className="relative text-[13px] tabular-nums text-gray-600">{rub(l.volume)} т</span>
    </button>
  );
});

const Empty = () => <div className="h-8" />;

/** Биржевой стакан: слева заявки покупателей, справа цены производителей */
export default function OrderBook({
  asks,
  bids,
  onBuyAt,
}: {
  asks: Quote[];
  bids: Bid[];
  /** Клик по цене продавца — оставить заявку по ней */
  onBuyAt: (price: number, volume: number) => void;
}) {
  const askLevels = useMemo(() => aggregate(asks.map((q) => ({ price: q.price, volume: q.volume, regions: [q.regionId] })), false), [asks]);
  const bidLevels = useMemo(() => aggregate(bids, true), [bids]);

  const topAsks = askLevels.slice(0, ROWS);
  const topBids = bidLevels.slice(0, ROWS);
  const max = Math.max(1, ...topAsks.map((l) => l.volume), ...topBids.map((l) => l.volume));
  const askTotal = asks.reduce((s, q) => s + q.volume, 0);
  const bidTotal = bids.reduce((s, b) => s + b.volume, 0);
  const spread = topAsks[0] && topBids[0] ? topAsks[0].price - topBids[0].price : null;

  return (
    <div>
      {/* Шапка: стороны и спред */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 mb-2">
        <div className="px-3">
          <p className="text-sm font-semibold text-[#2f7a1f]">Покупают</p>
          <p className="text-xs text-gray-400 tabular-nums">
            {rub(bidTotal)} т · заявок {bids.length}
          </p>
        </div>
        <div className="text-center pb-0.5">
          <p className="text-[11px] text-gray-400">{spread !== null && spread <= 0 ? "цены сошлись" : "спред"}</p>
          <p className={"text-sm font-semibold tabular-nums " + (spread !== null && spread <= 0 ? "text-[#2f7a1f]" : "text-gray-700")}>
            {spread === null ? "—" : spread <= 0 ? "сделка" : `${rub(spread)} ₽`}
          </p>
        </div>
        <div className="px-3 text-right">
          <p className="text-sm font-semibold text-[#c0492f]">Продают</p>
          <p className="text-xs text-gray-400 tabular-nums">
            {rub(askTotal)} т · предпр. {asks.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6">
        <div>
          <div className="flex justify-between px-3 pb-1 text-[11px] text-gray-400">
            <span>Объём</span>
            <span>Цена, ₽/т</span>
          </div>
          {topBids.map((l) => (
            <BidRow key={l.price} l={l} max={max} />
          ))}
          {Array.from({ length: ROWS - topBids.length }, (_, i) => (
            <Empty key={i} />
          ))}
        </div>
        <div>
          <div className="flex justify-between px-3 pb-1 text-[11px] text-gray-400">
            <span>Цена, ₽/т</span>
            <span>Объём</span>
          </div>
          {topAsks.map((l) => (
            <AskRow key={l.price} l={l} max={max} onClick={() => onBuyAt(l.price, l.volume)} />
          ))}
          {Array.from({ length: ROWS - topAsks.length }, (_, i) => (
            <Empty key={i} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-6 mt-1 h-4 text-[11px] text-gray-400">
        <span className="px-3">{bidLevels.length > ROWS ? `ещё ${bidLevels.length - ROWS} цен ниже` : ""}</span>
        <span className="px-3 text-right">{askLevels.length > ROWS ? `ещё ${askLevels.length - ROWS} цен выше` : ""}</span>
      </div>
    </div>
  );
}
