"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Layers, List, Map as MapIcon, Minus } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import PriceChart from "@/components/market/PriceChart";
import RussiaMap from "@/components/market/RussiaMap";
import RegionPicker from "@/components/market/RegionPicker";
import OrderBook from "@/components/market/OrderBook";
import {
  computeIndex,
  dailySeries,
  inScope,
  intradaySeries,
  lastHistoryDay,
  type IndexStats,
  type Scope,
} from "@/lib/market/aggregate";
import { CROPS, CROP_BY_ID, type CropId } from "@/lib/market/crops";
import { DIRECTIONS, DIRECTION_BY_ID, REGIONS, REGION_BY_ID, type DirectionId, type RegionId } from "@/lib/market/regions";
import { ago, pct, rub, time, tons } from "@/lib/market/format";
import type { DailyClose, Quote } from "@/lib/market/types";
import { openLead } from "@/lib/lead";

type Tab = "book" | "chart" | "map" | "regions";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "book", label: "Стакан", icon: Layers },
  { id: "chart", label: "График", icon: BarChart3 },
  { id: "map", label: "Карта", icon: MapIcon },
  { id: "regions", label: "Регионы", icon: List },
];

const PERIODS = [
  { id: "day", label: "Сегодня", days: 1 },
  { id: "7", label: "Неделя", days: 7 },
  { id: "30", label: "Месяц", days: 30 },
  { id: "90", label: "3 месяца", days: 90 },
] as const;

function Change({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-gray-400">—</span>;
  const up = value > 0.0005;
  const down = value < -0.0005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={"inline-flex items-center gap-0.5 font-semibold tabular-nums " + (up ? "text-[#2f7a1f]" : down ? "text-[#c0492f]" : "text-gray-500")}>
      <Icon size={14} />
      {pct(value)}
    </span>
  );
}

function LiveAgo({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  return <>{since ? ago(since, now) : "—"}</>;
}

/** График рендерится только на своей вкладке */
function ChartPanel({
  today,
  history,
  latest,
  scope,
  nowTs,
  minCount,
}: {
  today: Quote[];
  history: DailyClose[];
  latest: Map<string, Quote>;
  scope: Scope;
  nowTs: number;
  minCount: number;
}) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("day");
  const series = useMemo(() => {
    const p = PERIODS.find((x) => x.id === period)!;
    return period === "day" ? intradaySeries(today, scope, minCount) : dailySeries(history, latest, scope, p.days, nowTs);
  }, [period, today, history, latest, scope, nowTs, minCount]);

  return (
    <div>
      <div className="flex bg-gray-100 p-1 rounded-lg w-fit mb-5">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={
              "px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors " +
              (period === p.id ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="h-[300px] md:h-[380px]">
        <PriceChart points={series} kind={period === "day" ? "intraday" : "daily"} animKey={`${period}-${scope.direction}-${scope.region}`} />
      </div>
    </div>
  );
}

/** Таблица регионов — только на своей вкладке */
function RegionsPanel({
  regionStats,
  prevCloses,
  direction,
  selected,
  onPick,
}: {
  regionStats: Map<RegionId, IndexStats>;
  prevCloses: DailyClose[];
  direction: DirectionId | "all";
  selected: RegionId | null;
  onPick: (id: RegionId) => void;
}) {
  const rows = useMemo(() => {
    const list = REGIONS.filter((r) => regionStats.has(r.id) && (direction === "all" || r.directions.includes(direction))).map((r) => {
      const st = regionStats.get(r.id)!;
      const prev = computeIndex(prevCloses.filter((h) => h.regionId === r.id));
      return { id: r.id, st, change: prev ? st.index / prev.index - 1 : null };
    });
    return list.sort((a, b) => a.st.index - b.st.index);
  }, [regionStats, prevCloses, direction]);
  const min = rows[0]?.st.index ?? 0;
  const max = rows[rows.length - 1]?.st.index ?? 1;

  return (
    <div>
      <div className="hidden md:grid grid-cols-[1.5fr_1.6fr_0.7fr_0.9fr] gap-4 px-3 pb-3 text-xs text-gray-400">
        <span>Регион</span>
        <span>Цена, ₽/т</span>
        <span className="text-right">К вчера</span>
        <span className="text-right">Готовы отгрузить</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto agr-scroll">
        {rows.map((r, i) => (
          <button
            key={r.id}
            onClick={() => onPick(r.id)}
            className={"w-full text-left px-3 py-3 rounded-lg transition-colors " + (selected === r.id ? "bg-[#f3f8ee]" : "hover:bg-gray-50")}
          >
            <span className="grid grid-cols-[1fr_auto] md:grid-cols-[1.5fr_1.6fr_0.7fr_0.9fr] gap-x-4 gap-y-0.5 items-center">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 truncate">{REGION_BY_ID[r.id].name}</span>
                <span className="block text-xs text-gray-400">
                  {r.st.count} предпр.
                  {i === 0 && <span className="ml-1.5 text-[#2f7a1f] font-medium">дешевле всего</span>}
                </span>
              </span>
              <span className="flex items-center gap-3 justify-end md:justify-start">
                <span className="hidden md:block flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-[#8CC152]"
                    style={{ width: `${18 + ((r.st.index - min) / Math.max(1, max - min)) * 82}%` }}
                  />
                </span>
                <span className="text-sm font-bold tabular-nums text-gray-900 md:w-16 text-right">{rub(r.st.index)}</span>
              </span>
              <span className="text-xs md:text-right">
                <Change value={r.change} />
              </span>
              <span className="text-right text-sm tabular-nums text-gray-600">{tons(r.st.volume)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Terminal() {
  const { ready, mode, crop, setCrop, supported, companies, companyById, today, history, latest, lastEventAt } = useMarket();
  const [direction, setDirection] = useState<DirectionId | "all">("all");
  const [region, setRegion] = useState<RegionId | null>(null);
  const [tab, setTab] = useState<Tab>("book");

  const scope = useMemo<Scope>(() => ({ direction, region }), [direction, region]);
  const cropInfo = CROP_BY_ID[crop];

  // Прошлые дни меняются только при загрузке — считаем отдельно от живого потока
  const prevCloses = useMemo(() => {
    const d = lastHistoryDay(history);
    return history.filter((h) => h.day === d);
  }, [history]);

  const live = useMemo(() => {
    if (!ready) return null;
    const all = [...latest.values()];
    const inS = all.filter((q) => inScope(q.regionId, scope));
    const stats = computeIndex(inS);
    const prevStats = computeIndex(prevCloses.filter((h) => inScope(h.regionId, scope)));
    const regionStats = new Map<RegionId, IndexStats>();
    for (const r of REGIONS) {
      const st = computeIndex(all.filter((q) => q.regionId === r.id));
      if (st) regionStats.set(r.id, st);
    }
    const dirPrice = new Map<DirectionId | "all", number | undefined>([["all", computeIndex(all)?.index]]);
    for (const d of DIRECTIONS) dirPrice.set(d.id, computeIndex(all.filter((q) => REGION_BY_ID[q.regionId].directions.includes(d.id)))?.index);
    const total = companies.filter((c) => inScope(c.regionId, scope)).length;
    return { inS, stats, change: stats && prevStats ? stats.index / prevStats.index - 1 : null, regionStats, dirPrice, total };
  }, [ready, latest, prevCloses, companies, scope]);

  const feed = useMemo(
    () => today.filter((q) => inScope(q.regionId, scope)).sort((a, b) => b.at - a.at).slice(0, 8),
    [today, scope]
  );

  const chooseCrop = (c: CropId) => {
    setCrop(c);
    if (region && !CROP_BY_ID[c].regions.includes(region)) setRegion(null);
  };
  const selectRegion = (r: RegionId | null) => {
    if (r && direction !== "all" && !REGION_BY_ID[r].directions.includes(direction)) setDirection("all");
    setRegion(r);
  };

  const s = live?.stats;
  const minCount = region ? 1 : Math.max(3, Math.round((live?.total ?? 0) * 0.35));

  return (
    <section id="terminal" className="bg-white py-16 md:py-24 px-4 md:px-8 scroll-mt-4">
      <div className="max-w-6xl mx-auto">
        {/* Заголовок */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[34px] md:text-[46px] font-semibold tracking-tight text-[#111] leading-none">Котировки</h2>
            <p className="text-gray-500 mt-3">₽ за тонну с НДС · самовывоз со склада производителя</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {mode === "demo" && <span className="rounded-full bg-amber-50 text-amber-800 px-3 py-1 font-medium">демо-данные</span>}
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f3f8ee] text-[#1F5A25] px-3 py-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f9a2a] agr-pulse" />
              обновлено <LiveAgo since={lastEventAt} />
            </span>
          </div>
        </div>

        {/* Культура */}
        <div className="mt-8 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0" role="tablist" aria-label="Культура">
          {CROPS.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={crop === c.id}
              onClick={() => chooseCrop(c.id)}
              className={
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors " +
                (crop === c.id ? "bg-[#1F5A25] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900")
              }
            >
              {c.name}
              {mode === "live" && !c.live && <span className="ml-1.5 text-[11px] opacity-60">скоро</span>}
            </button>
          ))}
        </div>

        {!supported ? (
          <div className="mt-10 rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-xl font-semibold text-gray-900">{cropInfo.name}: подключаем производителей</p>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">Котировки появятся, как только предприятия начнут присылать цены в бот.</p>
            <button onClick={() => openLead("producer")} className="mt-6 rounded-xl bg-[#1F5A25] text-white px-5 py-3 font-semibold hover:bg-[#174a1c]">
              Подключить предприятие
            </button>
          </div>
        ) : (
          <>
            {/* Фильтры: одна строка */}
            <div id="terminal-summary" className="mt-8 flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-8 scroll-mt-6">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Куда поставка</p>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                  {[{ id: "all" as const, name: "Все" }, ...DIRECTIONS].map((d) => {
                    const on = direction === d.id;
                    const price = live?.dirPrice.get(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => {
                          setDirection(d.id);
                          setRegion(null);
                        }}
                        className={
                          "shrink-0 rounded-xl border px-3.5 py-2 text-left transition-colors " +
                          (on ? "border-[#1F5A25] bg-[#f3f8ee]" : "border-gray-200 hover:border-gray-300")
                        }
                      >
                        <span className={"block text-sm font-medium " + (on ? "text-[#1F5A25]" : "text-gray-800")}>{d.name}</span>
                        <span className="block text-xs text-gray-500 tabular-nums">{price ? `${rub(price)} ₽` : "—"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Регион · из списка или на карте</p>
                <RegionPicker value={region} onChange={selectRegion} stats={live?.regionStats ?? new Map()} available={cropInfo.regions} />
              </div>
            </div>
            {direction !== "all" && !region && (
              <p className="mt-3 text-sm text-gray-500">
                Пункты отгрузки: <span className="text-gray-700">{DIRECTION_BY_ID[direction].hubs}</span>
              </p>
            )}

            {/* Три главные цифры — в одной карточке */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 rounded-2xl border border-[#e6ebe1] divide-y md:divide-y-0 md:divide-x divide-[#e6ebe1]">
              <div className="p-6 md:p-7">
                <p className="text-sm text-gray-500" title="Медиана: половина предприятий продаёт дешевле, половина — дороже">
                  Средняя цена
                </p>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-[#111]">
                  {s ? rub(s.index) : "—"} <span className="text-lg font-medium text-gray-400">₽/т</span>
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  <Change value={live?.change ?? null} /> к вчера
                </p>
              </div>
              <div className="p-6 md:p-7">
                <p className="text-sm text-gray-500">Разброс цен</p>
                <p className="mt-2 text-[26px] leading-[40px] font-bold tabular-nums text-[#111]">{s ? `${rub(s.min)} – ${rub(s.max)}` : "—"}</p>
                <p className="mt-2 text-sm text-gray-500">
                  у большинства <span className="tabular-nums text-gray-700">{s ? `${rub(s.p25)} – ${rub(s.p75)}` : "—"}</span>
                </p>
              </div>
              <div className="p-6 md:p-7">
                <p className="text-sm text-gray-500">Готовы отгрузить</p>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-[#111]">
                  {s ? rub(s.volume) : "—"} <span className="text-lg font-medium text-gray-400">т</span>
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  <span className="tabular-nums text-gray-700">{live?.inS.length ?? 0}</span> из {live?.total ?? 0} предприятий прислали цену
                </p>
              </div>
            </div>

            {/* Главная панель с вкладками + лента */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
              <div className="rounded-2xl border border-[#e6ebe1] p-5 md:p-7 min-w-0">
                <div className="flex gap-1 border-b border-gray-100 -mx-5 md:-mx-7 px-5 md:px-7 mb-6 overflow-x-auto no-scrollbar" role="tablist">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                      className={
                        "shrink-0 inline-flex items-center gap-2 px-3 pb-3 -mb-px border-b-2 text-sm font-medium transition-colors " +
                        (tab === t.id ? "border-[#1F5A25] text-[#1F5A25]" : "border-transparent text-gray-500 hover:text-gray-800")
                      }
                    >
                      <t.icon size={16} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {live && tab === "book" && <OrderBook quotes={live.inS} />}
                {live && tab === "chart" && (
                  <ChartPanel today={today} history={history} latest={latest} scope={scope} nowTs={lastEventAt} minCount={minCount} />
                )}
                {live && tab === "map" && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">Чем темнее регион, тем дешевле. Нажмите на регион, чтобы выбрать его.</p>
                    <RussiaMap stats={live.regionStats} direction={direction} selected={region} onSelect={(id) => selectRegion(region === id ? null : id)} />
                  </div>
                )}
                {live && tab === "regions" && (
                  <RegionsPanel
                    regionStats={live.regionStats}
                    prevCloses={prevCloses}
                    direction={direction}
                    selected={region}
                    onPick={(id) => selectRegion(region === id ? null : id)}
                  />
                )}
              </div>

              <aside className="rounded-2xl border border-[#e6ebe1] p-5 md:p-6">
                <p className="font-semibold text-gray-900">Последние цены</p>
                <p className="text-xs text-gray-400 mt-0.5 mb-3">приходят из бота в реальном времени</p>
                <ul>
                  {feed.map((q) => {
                    const bad = q.status !== "accepted";
                    return (
                      <li key={q.id} className="relative py-3 border-b border-gray-100 last:border-b-0">
                        <span className="agr-flash absolute -inset-x-2 inset-y-0 rounded-lg" />
                        <div className="relative flex items-baseline justify-between gap-2 text-xs text-gray-400">
                          <span className="truncate">{REGION_BY_ID[q.regionId].name}</span>
                          <span className="tabular-nums shrink-0">{time(q.at)}</span>
                        </div>
                        <div className="relative flex items-baseline justify-between gap-2 mt-0.5">
                          <span className={"text-sm tabular-nums " + (bad ? "text-gray-400 line-through" : "font-semibold text-gray-900")}>
                            {rub(q.price)} ₽ · <span className="font-normal text-gray-500">{tons(q.volume)}</span>
                          </span>
                          <span className={"text-[11px] shrink-0 " + (bad ? "text-[#c0492f]" : "text-gray-400")}>
                            {bad
                              ? q.status === "moderation"
                                ? "на проверке"
                                : "не учтено"
                              : q.revision > 1 && q.prevPrice && q.prevPrice !== q.price
                                ? `было ${rub(q.prevPrice)}`
                                : q.revision > 1
                                  ? "обновлён объём"
                                  : companyById.get(q.companyId)?.code}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  {feed.length === 0 && <li className="py-6 text-sm text-gray-400">Сегодня подач пока нет</li>}
                </ul>
              </aside>
            </div>

            {/* Действие */}
            <div className="mt-8 rounded-2xl bg-[#1F5A25] text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <p className="text-xl md:text-2xl font-semibold">Нужен объём по этой цене?</p>
                <p className="text-white/75 mt-1">Соберём партию у производителей и доставим до порта или границы.</p>
              </div>
              <button
                onClick={() => openLead("exporter")}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#1F5A25] px-6 py-3 font-semibold hover:bg-[#f3f8ee] transition-colors"
              >
                Оставить заявку <ArrowRight size={17} />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
