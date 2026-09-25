"use client";

import React, { memo, useMemo, useState } from "react";
import { shortRegionName, type RegionId } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";
import { BUYER_LABEL, type Bid, type BuyerType, type Quote } from "@/lib/market/types";

/** Сколько лучших цен показываем с каждой стороны — всё помещается без прокрутки */
const ROWS = 8;

interface Level {
  price: number;
  volume: number;
  count: number;
  own: boolean;
  regions: RegionId[];
  buyers: BuyerType[];
}

function aggregate(
  items: { price: number; volume: number; own?: boolean; regions: RegionId[]; buyer?: BuyerType }[],
  desc: boolean
): Level[] {
  const map = new Map<number, Level>();
  for (const it of items) {
    let l = map.get(it.price);
    if (!l) map.set(it.price, (l = { price: it.price, volume: 0, count: 0, own: false, regions: [], buyers: [] }));
    l.volume += it.volume;
    l.count += 1;
    l.own ||= !!it.own;
    for (const r of it.regions) if (!l.regions.includes(r)) l.regions.push(r);
    if (it.buyer && !l.buyers.includes(it.buyer)) l.buyers.push(it.buyer);
  }
  return [...map.values()].sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
}

/**
 * Номер «вспышки»: растёт, только когда у строки реально изменился объём.
 * При появлении строки (в т.ч. при смене культуры) вспышки нет — экран не заливает цветом.
 */
function useChangeFlash(signature: string): number {
  const [prev, setPrev] = useState(signature);
  const [n, setN] = useState(0);
  if (signature !== prev) {
    setPrev(signature);
    setN(n + 1);
  }
  return n;
}

const buyersText = (b: BuyerType[]) =>
  b.length === 2 ? "экспортёры и агенты" : b.length === 1 ? BUYER_LABEL[b[0]] : "";

const BidRow = memo(function BidRow({ l, max, onClick }: { l: Level; max: number; onClick?: () => void }) {
  const flash = useChangeFlash(`${l.volume}-${l.count}`);
  const who = buyersText(l.buyers);
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={"group relative w-full h-7 flex items-center justify-between gap-2 px-3 rounded-md transition-colors " + (onClick ? "hover:bg-gray-50" : "cursor-default")}
      title={`${who ? who[0].toUpperCase() + who.slice(1) + " · " : ""}${
        l.regions.length ? `готовы брать: ${l.regions.map(shortRegionName).join(", ")}` : "из любого региона"
      }${onClick ? " · нажмите, чтобы продать по этой цене" : ""}`}
    >
      {flash > 0 && <span key={flash} className="agr-flash absolute inset-0 rounded-md" />}
      <span
        className="absolute right-0 inset-y-0.5 rounded-md bg-[#2f7a1f]/10 transition-[width] duration-500"
        style={{ width: `${(l.volume / max) * 100}%` }}
      />
      <span className="relative flex items-center gap-1.5 min-w-0 text-[13px] tabular-nums text-gray-600">
        <span className="shrink-0">{rub(l.volume)} т</span>
        {l.own ? (
          <span className="text-[10px] rounded bg-[#2f7a1f] text-white px-1 py-px shrink-0">ваша</span>
        ) : (
          who && <span className="hidden sm:inline text-[11px] text-gray-400 truncate">{who}</span>
        )}
      </span>
      <span className="relative flex items-center gap-1.5 shrink-0">
        {onClick && <span className="hidden group-hover:inline text-[10px] font-semibold text-[#2f7a1f] border border-[#2f7a1f]/30 bg-white rounded px-1">продать</span>}
        <span className="text-sm font-bold tabular-nums text-[#2f7a1f]">{rub(l.price)}</span>
      </span>
    </button>
  );
});

const AskRow = memo(function AskRow({ l, max, onClick }: { l: Level; max: number; onClick?: () => void }) {
  const flash = useChangeFlash(`${l.volume}-${l.count}`);
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={"group relative w-full h-7 flex items-center justify-between gap-2 px-3 rounded-md transition-colors " + (onClick ? "hover:bg-gray-50" : "cursor-default")}
      title={`Предприятия: ${l.regions.map(shortRegionName).join(", ")}${onClick ? " · нажмите, чтобы купить по этой цене" : ""}`}
    >
      {flash > 0 && <span key={flash} className="agr-flash-ask absolute inset-0 rounded-md" />}
      <span
        className="absolute left-0 inset-y-0.5 rounded-md bg-[#c0492f]/10 transition-[width] duration-500"
        style={{ width: `${(l.volume / max) * 100}%` }}
      />
      <span className="relative flex items-center gap-1.5 shrink-0">
        <span className="text-sm font-bold tabular-nums text-[#c0492f]">{rub(l.price)}</span>
        {onClick && <span className="hidden group-hover:inline text-[10px] font-semibold text-[#c0492f] border border-[#c0492f]/30 bg-white rounded px-1">купить</span>}
      </span>
      <span className="relative flex items-center gap-1.5 min-w-0 text-[13px] tabular-nums text-gray-600">
        <span className={"hidden sm:inline text-[11px] text-gray-400 truncate " + (onClick ? "group-hover:!hidden" : "")}>
          {l.count > 1 ? `${l.count} предпр.` : shortRegionName(l.regions[0])}
        </span>
        <span className="shrink-0">{rub(l.volume)} т</span>
      </span>
    </button>
  );
});

const Empty = () => <div className="h-7" />;

/** Биржевой стакан: слева заявки покупателей (экспортёры и агенты), справа цены предприятий */
export default function OrderBook({
  asks,
  bids,
  onBuyAt,
  onSellAt,
}: {
  asks: Quote[];
  bids: Bid[];
  /** Экспортёр/агент: купить по цене предприятия. Нет — цены предприятий не кликабельны */
  onBuyAt?: (price: number, volume: number) => void;
  /** Предприятие: продать по цене покупателя. Нет — заявки покупателей не кликабельны */
  onSellAt?: (price: number, volume: number) => void;
}) {
  const askLevels = useMemo(() => aggregate(asks.map((q) => ({ price: q.price, volume: q.volume, regions: [q.regionId] })), false), [asks]);
  const bidLevels = useMemo(() => aggregate(bids, true), [bids]);

  const topAsks = askLevels.slice(0, ROWS);
  const topBids = bidLevels.slice(0, ROWS);
  const max = Math.max(1, ...topAsks.map((l) => l.volume), ...topBids.map((l) => l.volume));
  const askTotal = asks.reduce((s, q) => s + q.volume, 0);
  const bidTotal = bids.reduce((s, b) => s + b.volume, 0);
  const spread = topAsks[0] && topBids[0] ? topAsks[0].price - topBids[0].price : null;
  const matched = spread !== null && spread <= 0;

  return (
    <div>
      {/* Шапка: кто покупает, кто продаёт, спред */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 mb-2">
        <div className="px-3 min-w-0">
          <p className="text-sm font-semibold text-[#2f7a1f] leading-tight">
            Покупают <span className="block sm:inline font-normal text-gray-500 text-xs sm:text-sm">экспортёры и агенты</span>
          </p>
          <p className="text-xs text-gray-400 tabular-nums">
            {rub(bidTotal)} т · заявок {bids.length}
          </p>
        </div>
        <div className="text-center pb-0.5">
          <p className="text-[11px] text-gray-400">{matched ? "цены сошлись" : "спред"}</p>
          <p className={"text-sm font-semibold tabular-nums " + (matched ? "text-[#2f7a1f]" : "text-gray-700")}>
            {spread === null ? "—" : matched ? "сделка" : `${rub(spread)} ₽`}
          </p>
        </div>
        <div className="px-3 text-right min-w-0">
          <p className="text-sm font-semibold text-[#c0492f] leading-tight">
            <span className="hidden sm:inline font-normal text-gray-500">предприятия </span>Продают
            <span className="block sm:hidden font-normal text-gray-500 text-xs">предприятия</span>
          </p>
          <p className="text-xs text-gray-400 tabular-nums">
            {rub(askTotal)} т · предприятий {asks.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6">
        <div>
          <div className="flex justify-between px-3 pb-1 text-[11px] text-gray-400">
            <span>
              Объём<span className="hidden sm:inline"> · покупатель</span>
            </span>
            <span>Цена, ₽/т</span>
          </div>
          {topBids.map((l) => (
            <BidRow key={l.price} l={l} max={max} onClick={onSellAt && (() => onSellAt(l.price, l.volume))} />
          ))}
          {Array.from({ length: ROWS - topBids.length }, (_, i) => (
            <Empty key={i} />
          ))}
        </div>
        <div>
          <div className="flex justify-between px-3 pb-1 text-[11px] text-gray-400">
            <span>Цена, ₽/т</span>
            <span>
              <span className="hidden sm:inline">регион · </span>объём
            </span>
          </div>
          {topAsks.map((l) => (
            <AskRow key={l.price} l={l} max={max} onClick={onBuyAt && (() => onBuyAt(l.price, l.volume))} />
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
