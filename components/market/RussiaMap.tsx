"use client";

import React, { useMemo, useRef, useState } from "react";
import mapData from "@/lib/market/russia-map.json";
import type { IndexStats } from "@/lib/market/aggregate";
import { MAP_NAME, REGIONS, REGION_BY_ID, type DirectionId, type RegionId } from "@/lib/market/regions";
import { rub, tons } from "@/lib/market/format";

const BY_MAP_NAME = new Map(REGIONS.map((r) => [MAP_NAME[r.id], r.id]));

// Дешевле — темнее зелёный, дороже — светлее
const CHEAP = [31, 90, 37];
const DEAR = [201, 228, 167];
function shade(t: number): string {
  const c = CHEAP.map((v, i) => Math.round(v + (DEAR[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

interface Hover {
  name: string;
  regionId?: RegionId;
  x: number;
  y: number;
  /** Ширина карты в момент наведения — чтобы подсказка не вылезала за край */
  w: number;
}

export default function RussiaMap({
  stats,
  direction,
  selected,
  onSelect,
}: {
  stats: Map<RegionId, IndexStats>;
  direction: DirectionId | "all";
  selected: RegionId | null;
  onSelect: (id: RegionId) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const { min, max } = useMemo(() => {
    const prices = [...stats.values()].map((s) => s.index);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [stats]);

  const fillFor = (id: RegionId | undefined) => {
    if (!id) return "#eef1ea";
    const s = stats.get(id);
    if (!s) return "#dfe5d8";
    const t = max > min ? (s.index - min) / (max - min) : 0.5;
    return shade(t);
  };

  const inDirection = (id: RegionId) => direction === "all" || REGION_BY_ID[id].directions.includes(direction);

  const move = (e: React.PointerEvent, name: string, regionId?: RegionId) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    setHover({ name, regionId, x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width });
  };

  // Выбранный регион рисуем последним, чтобы обводка была поверх соседей
  const ordered = [...mapData.regions].sort((a, b) => {
    const sa = BY_MAP_NAME.get(a.name) === selected ? 1 : 0;
    const sb = BY_MAP_NAME.get(b.name) === selected ? 1 : 0;
    return sa - sb;
  });

  const hs = hover?.regionId ? stats.get(hover.regionId) : undefined;

  return (
    <div ref={wrapRef} className="relative w-full select-none" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${mapData.width} ${mapData.height}`} className="w-full h-auto" role="group" aria-label="Карта регионов России">
        {ordered.map((r) => {
          const id = BY_MAP_NAME.get(r.name);
          const producing = !!id;
          const dim = producing && !selected && !inDirection(id!);
          const isSel = id === selected;
          const isHover = hover?.name === r.name;
          return (
            <path
              key={r.name}
              d={r.d}
              fill={fillFor(id)}
              fillOpacity={dim ? 0.35 : 1}
              stroke={isSel ? "#0f2413" : isHover && producing ? "#1F5A25" : "#ffffff"}
              strokeWidth={isSel ? 2.5 : isHover && producing ? 1.8 : 0.7}
              strokeLinejoin="round"
              className={producing ? "cursor-pointer transition-[fill-opacity] duration-300 outline-none" : ""}
              role={producing ? "button" : undefined}
              tabIndex={producing ? 0 : undefined}
              aria-label={producing ? REGION_BY_ID[id!].name : undefined}
              onPointerMove={(e) => move(e, r.name, id)}
              onClick={() => id && onSelect(id)}
              onKeyDown={(e) => {
                if (id && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(id);
                }
              }}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-[#0f2413] text-white px-3 py-2 shadow-xl text-xs whitespace-nowrap"
          style={{ left: Math.min(Math.max(hover.x + 14, 0), hover.w - 190), top: Math.max(hover.y - 64, 0) }}
        >
          <p className="font-semibold text-[13px]">{hover.regionId ? REGION_BY_ID[hover.regionId].name : hover.name}</p>
          {hs ? (
            <>
              <p className="tabular-nums mt-0.5">
                <span className="font-bold">{rub(hs.index)} ₽/т</span> · {tons(hs.volume)}
              </p>
              <p className="text-white/60">{hs.count} предпр. · нажмите, чтобы выбрать</p>
            </>
          ) : (
            <p className="text-white/60 mt-0.5">{hover.regionId ? "сегодня цен ещё нет" : "нет производителей в базе"}</p>
          )}
        </div>
      )}

      {/* Легенда */}
      {Number.isFinite(min) && (
        <div className="absolute left-2 bottom-1 md:left-3 md:bottom-2 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur px-2.5 py-1.5 text-[11px] text-gray-600 shadow-sm">
          <span className="tabular-nums">{rub(min)}</span>
          <span className="h-2 w-20 md:w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${shade(0)}, ${shade(1)})` }} />
          <span className="tabular-nums">{rub(max)} ₽/т</span>
        </div>
      )}
    </div>
  );
}
