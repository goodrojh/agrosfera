"use client";

import React, { memo, useCallback, useMemo, useRef } from "react";
import mapData from "@/lib/market/russia-map.json";
import type { IndexStats } from "@/lib/market/aggregate";
import { MAP_NAME, REGIONS, REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { rub, tons } from "@/lib/market/format";

const BY_MAP_NAME = new Map(REGIONS.map((r) => [MAP_NAME[r.id], r.id]));
const MAP_NAME_TO_REGION = (name: string) => BY_MAP_NAME.get(name);

// Дешевле — темнее зелёный, дороже — светлее
const CHEAP = [31, 90, 37];
const DEAR = [201, 228, 167];
function shade(t: number): string {
  const c = CHEAP.map((v, i) => Math.round(v + (DEAR[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Контуры рисуются один раз и меняются только при смене цен/выбора — не при движении мыши */
const Regions = memo(function Regions({
  fills,
  dimmed,
  selected,
}: {
  fills: Map<string, string>;
  dimmed: Set<string>;
  selected: string[];
}) {
  return (
    <>
      {mapData.regions.map((r) => {
        const id = MAP_NAME_TO_REGION(r.name);
        return (
          <path
            key={r.name}
            d={r.d}
            data-name={r.name}
            fill={fills.get(r.name) ?? "#eef1ea"}
            fillOpacity={dimmed.has(r.name) ? 0.35 : 1}
            className={id ? "agr-map-region" : "agr-map-empty"}
            role={id ? "button" : undefined}
            tabIndex={id ? 0 : undefined}
            aria-label={id ? REGION_BY_ID[id].name : undefined}
          />
        );
      })}
      {/* Обводка выбранных регионов поверх соседей */}
      {selected.map((name) => (
        <path key={name} d={mapData.regions.find((r) => r.name === name)?.d} fill="none" stroke="#0f2413" strokeWidth={2.2} pointerEvents="none" />
      ))}
    </>
  );
});

export default function RussiaMap({
  stats,
  selected,
  onToggle,
}: {
  stats: Map<RegionId, IndexStats>;
  /** Выбранные регионы (можно несколько) */
  selected: RegionId[];
  /** Клик по региону: добавить или убрать из выбора */
  onToggle: (id: RegionId) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hoverName = useRef<string | null>(null);

  const { fills, dimmed, min, max } = useMemo(() => {
    const prices = [...stats.values()].map((s) => s.index);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const f = new Map<string, string>();
    const d = new Set<string>();
    for (const r of REGIONS) {
      const s = stats.get(r.id);
      f.set(MAP_NAME[r.id], s ? shade(hi > lo ? (s.index - lo) / (hi - lo) : 0.5) : "#dfe5d8");
      // Когда что-то выбрано, остальные регионы приглушаем — выбор видно сразу
      if (selected.length && !selected.includes(r.id)) d.add(MAP_NAME[r.id]);
    }
    return { fills: f, dimmed: d, min: lo, max: hi };
  }, [stats, selected]);
  const selectedNames = useMemo(() => selected.map((id) => MAP_NAME[id]), [selected]);

  const tipHtml = useCallback(
    (name: string) => {
      const id = MAP_NAME_TO_REGION(name);
      const s = id ? stats.get(id) : undefined;
      const title = id ? REGION_BY_ID[id].name : name;
      if (s) {
        return `<p class="font-semibold text-[13px]">${title}</p><p class="tabular-nums mt-0.5"><b>${rub(s.index)} ₽/т</b> · ${tons(s.volume)}</p><p class="text-white/60">${s.count} предпр. · нажмите, чтобы отметить</p>`;
      }
      return `<p class="font-semibold text-[13px]">${title}</p><p class="text-white/60 mt-0.5">${id ? "сегодня цен ещё нет" : "нет производителей этой культуры"}</p>`;
    },
    [stats]
  );

  // Подсказка двигается напрямую через DOM — без перерисовки 83 контуров
  const onMove = (e: React.PointerEvent) => {
    const tip = tipRef.current;
    const wrap = wrapRef.current;
    if (!tip || !wrap) return;
    const name = (e.target as Element).getAttribute?.("data-name");
    if (!name) {
      tip.style.opacity = "0";
      hoverName.current = null;
      return;
    }
    if (hoverName.current !== name) {
      hoverName.current = name;
      tip.innerHTML = tipHtml(name);
    }
    const rect = wrap.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left + 14, 0), rect.width - 200);
    const y = Math.max(e.clientY - rect.top - 70, 0);
    tip.style.transform = `translate(${x}px, ${y}px)`;
    tip.style.opacity = "1";
  };

  const pick = (e: React.SyntheticEvent) => {
    const name = (e.target as Element).getAttribute?.("data-name");
    const id = name ? MAP_NAME_TO_REGION(name) : undefined;
    if (id) onToggle(id);
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      onPointerMove={onMove}
      onPointerLeave={() => {
        if (tipRef.current) tipRef.current.style.opacity = "0";
        hoverName.current = null;
      }}
    >
      <svg
        viewBox={`0 0 ${mapData.width} ${mapData.height}`}
        className="w-full h-auto"
        role="group"
        aria-label="Карта регионов России"
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(e);
          }
        }}
      >
        <Regions fills={fills} dimmed={dimmed} selected={selectedNames} />
      </svg>

      <div
        ref={tipRef}
        className="pointer-events-none absolute left-0 top-0 z-10 rounded-xl bg-[#0f2413] text-white px-3 py-2 shadow-xl text-xs whitespace-nowrap opacity-0 transition-opacity duration-150"
      />

      {Number.isFinite(min) && (
        <div className="absolute left-0 bottom-0 flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] text-gray-600">
          <span className="tabular-nums">{rub(min)}</span>
          <span className="h-2 w-20 md:w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${shade(0)}, ${shade(1)})` }} />
          <span className="tabular-nums">{rub(max)} ₽/т</span>
        </div>
      )}
    </div>
  );
}
