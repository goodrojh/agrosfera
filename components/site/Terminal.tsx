"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Search, X } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import PriceChart from "@/components/market/PriceChart";
import {
  computeIndex,
  dailySeries,
  inScope,
  intradaySeries,
  lastHistoryDay,
  regionRows,
  type Scope,
} from "@/lib/market/aggregate";
import { DIRECTIONS, DIRECTION_BY_ID, REGIONS, REGION_BY_ID, type DirectionId, type RegionId } from "@/lib/market/regions";
import { ago, pct, rub, time, tons } from "@/lib/market/format";
import { TELEGRAM_BOT_URL } from "@/lib/config";
import { openLead } from "@/lib/lead";

const PERIODS = [
  { id: "day", label: "Сегодня", days: 1 },
  { id: "7", label: "Неделя", days: 7 },
  { id: "30", label: "Месяц", days: 30 },
  { id: "90", label: "3 месяца", days: 90 },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

function Change({ value, big = false }: { value: number | null; big?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-gray-400">—</span>;
  const up = value > 0.0005;
  const down = value < -0.0005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const tone = up ? "text-[#2f7a1f]" : down ? "text-[#c0492f]" : "text-gray-500";
  const bg = big ? (up ? "bg-[#8CC152]/15" : down ? "bg-[#E07A5F]/12" : "bg-gray-100") : "";
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums rounded-full ${big ? "text-sm px-2.5 py-1" : "text-xs"} ${tone} ${bg}`}>
      <Icon size={big ? 15 : 13} />
      {pct(value)}
    </span>
  );
}

function LiveAgo({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{since ? ago(since, now) : "—"}</>;
}

const card = "bg-white rounded-2xl border border-[#e6ebe1] shadow-[0_1px_2px_rgba(16,40,20,0.04)]";

export default function Terminal() {
  const { ready, mode, companies, companyById, today, history, latest, lastEventAt } = useMarket();
  const [direction, setDirection] = useState<DirectionId | "all">("all");
  const [region, setRegion] = useState<RegionId | null>(null);
  const [period, setPeriod] = useState<PeriodId>("day");
  const [query, setQuery] = useState("");

  const scope: Scope = { direction, region };
  // «Сейчас» для рынка — время последнего события: расчёт остаётся чистой функцией данных
  const nowTs = lastEventAt;

  const data = useMemo(() => {
    if (!ready) return null;
    const all = [...latest.values()];
    const inS = all.filter((q) => inScope(q.regionId, scope));
    const stats = computeIndex(inS);
    const prevDay = lastHistoryDay(history);
    const prevStats = computeIndex(history.filter((h) => h.day === prevDay && inScope(h.regionId, scope)));
    const p = PERIODS.find((x) => x.id === period)!;
    const total = companies.filter((c) => inScope(c.regionId, scope)).length;
    // Линия за сегодня начинается, когда цену прислала заметная часть предприятий — без ложных скачков по первым подачам
    const minCount = region ? 1 : Math.max(3, Math.round(total * 0.35));
    const series =
      period === "day" ? intradaySeries(today, scope, minCount) : dailySeries(history, latest, scope, p.days, nowTs);

    const rows = regionRows(latest, history, direction)
      .filter((r) => r.stats)
      .sort((a, b) => a.stats!.index - b.stats!.index);
    const rowMin = rows.length ? rows[0].stats!.index : 0;
    const rowMax = rows.length ? rows[rows.length - 1].stats!.index : 1;

    const directionCards = [
      { id: "all" as const, name: "Все регионы", hubs: `${REGIONS.length} регионов России`, stats: computeIndex(all) },
      ...DIRECTIONS.map((d) => ({
        id: d.id,
        name: d.name,
        hubs: d.hubs,
        stats: computeIndex(all.filter((q) => REGION_BY_ID[q.regionId].directions.includes(d.id))),
      })),
    ];

    const todayScoped = today.filter((q) => inScope(q.regionId, scope));
    const feed = [...todayScoped].sort((a, b) => b.at - a.at).slice(0, 12);

    return {
      stats,
      change: stats && prevStats ? stats.index / prevStats.index - 1 : null,
      series,
      rows,
      rowMin,
      rowMax,
      directionCards,
      feed,
      submitted: inS.length,
      total,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, latest, history, today, companies, direction, region, period, nowTs]);

  const s = data?.stats;
  const scopeName = region
    ? REGION_BY_ID[region].name
    : direction === "all"
      ? "все регионы"
      : `направление «${DIRECTION_BY_ID[direction].name}»`;
  const filteredRows = data?.rows.filter((r) => REGION_BY_ID[r.regionId].name.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const botHref = TELEGRAM_BOT_URL || "#bot";

  const pickDirection = (d: DirectionId | "all") => {
    setDirection(d);
    setRegion(null);
  };
  const pickRegion = (r: RegionId) => {
    setRegion(region === r ? null : r);
    document.getElementById("terminal-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="terminal" className="bg-white py-14 md:py-20 px-4 md:px-8 scroll-mt-4">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#8CC152]/15 text-[#1F5A25] px-3 py-1 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#4f9a2a] agr-pulse" />
              Обновлено <LiveAgo since={lastEventAt} />
            </span>
            {mode === "demo" && (
              <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 text-xs font-medium">демо-данные</span>
            )}
          </div>
          <h2 className="text-[32px] md:text-[44px] font-semibold tracking-tight text-[#111] leading-[1.1]">Котировки масличного льна</h2>
          <p className="text-gray-500 mt-2 max-w-2xl">
            Цена за тонну с НДС на складе производителя (EXW). Цены присылают сами предприятия — каждое утро и при любом изменении.
          </p>
        </div>

        {/* 1. Направление */}
        <p className="text-sm font-semibold text-gray-900 mb-3">Куда поставка?</p>
        <div className="flex md:grid md:grid-cols-5 gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {(data?.directionCards ?? []).map((d) => {
            const active = direction === d.id;
            return (
              <button
                key={d.id}
                onClick={() => pickDirection(d.id)}
                className={
                  "shrink-0 w-[210px] md:w-auto text-left rounded-2xl border p-4 transition-all " +
                  (active ? "border-[#1F5A25] bg-[#f3f8ee] ring-1 ring-[#1F5A25]" : "border-[#e6ebe1] bg-white hover:border-[#8CC152] hover:bg-[#fafcf8]")
                }
              >
                <p className={"text-sm font-semibold " + (active ? "text-[#1F5A25]" : "text-gray-900")}>{d.name}</p>
                <p className="text-xl font-bold tabular-nums text-[#111] mt-1.5">
                  {d.stats ? rub(d.stats.index) : "—"} <span className="text-sm font-medium text-gray-400">₽/т</span>
                </p>
                <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2">{d.hubs}</p>
              </button>
            );
          })}
        </div>

        {/* Что сейчас показано */}
        <div id="terminal-summary" className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-6 mb-4 text-sm scroll-mt-6">
          <span className="text-gray-500">Показано:</span>
          <span className="font-semibold text-gray-900">{scopeName}</span>
          {direction !== "all" && !region && <span className="text-gray-400">· {DIRECTION_BY_ID[direction].note}</span>}
          {region && (
            <button
              onClick={() => setRegion(null)}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 hover:bg-gray-200 px-2.5 py-0.5 text-xs text-gray-700 transition-colors"
            >
              сбросить регион <X size={12} />
            </button>
          )}
        </div>

        {/* 2. Три главные цифры */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={card + " p-5 md:p-6"}>
            <p className="text-sm text-gray-500">Средняя цена</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-[40px] leading-none font-bold tabular-nums text-[#111] tracking-tight">{s ? rub(s.index) : "—"}</p>
              <p className="text-lg text-gray-400 font-medium mb-0.5">₽/т</p>
            </div>
            <div className="flex items-center gap-2 mt-3 text-sm">
              <Change value={data?.change ?? null} big />
              <span className="text-gray-500">к вчера</span>
            </div>
            <p className="text-xs text-gray-400 mt-3">Медиана: половина предприятий продаёт дешевле, половина — дороже.</p>
          </div>

          <div className={card + " p-5 md:p-6"}>
            <p className="text-sm text-gray-500">Разброс цен</p>
            <p className="text-[26px] leading-tight font-bold tabular-nums text-[#111] mt-2">
              {s ? `${rub(s.min)} – ${rub(s.max)}` : "—"} <span className="text-base text-gray-400 font-medium">₽/т</span>
            </p>
            {s && (
              <div className="relative h-2.5 rounded-full bg-gray-100 mt-4">
                <motion.div
                  className="absolute h-full rounded-full bg-[#8CC152]/45"
                  animate={{
                    left: `${((s.p25 - s.min) / Math.max(1, s.max - s.min)) * 100}%`,
                    width: `${Math.max(3, ((s.p75 - s.p25) / Math.max(1, s.max - s.min)) * 100)}%`,
                  }}
                />
                <motion.div
                  className="absolute -top-1 h-[18px] w-[3px] rounded-full bg-[#1F5A25]"
                  animate={{ left: `calc(${((s.index - s.min) / Math.max(1, s.max - s.min)) * 100}% - 1.5px)` }}
                />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">
              У большинства предприятий:{" "}
              <span className="text-gray-600 font-medium tabular-nums">{s ? `${rub(s.p25)} – ${rub(s.p75)} ₽/т` : "—"}</span>
            </p>
          </div>

          <div className={card + " p-5 md:p-6"}>
            <p className="text-sm text-gray-500">Готовы отгрузить</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-[40px] leading-none font-bold tabular-nums text-[#111] tracking-tight">{s ? rub(s.volume) : "—"}</p>
              <p className="text-lg text-gray-400 font-medium mb-0.5">тонн</p>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              <span className="font-semibold tabular-nums">{data?.submitted ?? 0}</span> из {data?.total ?? 0} предприятий прислали цену сегодня
            </p>
            <p className="text-xs text-gray-400 mt-3">Свободный объём, который предприятия готовы продать сейчас.</p>
          </div>
        </div>

        {/* 3. График + последние цены */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className={card + " lg:col-span-2 p-5 md:p-6 flex flex-col"}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-gray-900">Как менялась цена</h3>
              <div className="flex bg-gray-100 p-1 rounded-xl">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={
                      "px-3 py-1.5 text-xs md:text-sm rounded-lg whitespace-nowrap transition-all " +
                      (period === p.id ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[280px] md:h-[340px]">
              {data && <PriceChart points={data.series} kind={period === "day" ? "intraday" : "daily"} animKey={`${period}-${direction}-${region}`} />}
            </div>
            <p className="text-xs text-gray-400 mt-3">Наведите на график, чтобы увидеть цену и объём в конкретный момент.</p>
          </div>

          <div className={card + " p-5 md:p-6 flex flex-col"}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Последние цены</h3>
              <span className="text-xs text-gray-400">из бота, онлайн</span>
            </div>
            <ul className="flex-1 overflow-y-auto no-scrollbar max-h-[380px] -mx-2">
              <AnimatePresence initial={false}>
                {data?.feed.map((q) => {
                  const bad = q.status !== "accepted";
                  return (
                    <motion.li
                      key={q.id}
                      layout
                      initial={{ opacity: 0, backgroundColor: "rgba(140,193,82,0.25)" }}
                      animate={{ opacity: 1, backgroundColor: "rgba(140,193,82,0)" }}
                      transition={{ duration: 1.2 }}
                      className="px-2 py-2.5 rounded-lg border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm text-gray-800 truncate">{REGION_BY_ID[q.regionId].name}</span>
                        <span className="text-xs text-gray-400 tabular-nums shrink-0">{time(q.at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={"text-sm tabular-nums " + (bad ? "text-gray-400 line-through" : "font-semibold text-gray-900")}>
                          {rub(q.price)} ₽/т <span className="font-normal text-gray-500">· {tons(q.volume)}</span>
                        </span>
                        {bad ? (
                          <span className="text-[11px] text-[#c0492f] shrink-0">{q.status === "moderation" ? "на проверке" : "не учтено"}</span>
                        ) : q.revision > 1 && q.prevPrice ? (
                          <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">было {rub(q.prevPrice)}</span>
                        ) : (
                          <span className="text-[11px] text-[#2f7a1f] shrink-0">новая</span>
                        )}
                      </div>
                      {bad && q.note && <p className="text-[11px] text-gray-400 mt-0.5">{q.note}</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">{companyById.get(q.companyId)?.code}</p>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        </div>

        {/* 4. Регионы */}
        <div className={card + " mt-4 p-5 md:p-6"}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Цены по регионам</h3>
              <p className="text-xs text-gray-500 mt-0.5">От дешёвых к дорогим. Нажмите на регион, чтобы посмотреть его график.</p>
            </div>
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти регион"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40"
              />
            </div>
          </div>

          <div className="hidden md:grid grid-cols-[1.4fr_1.6fr_0.7fr_0.8fr_0.6fr] gap-4 px-3 pb-2 text-xs text-gray-400">
            <span>Регион</span>
            <span>Цена, ₽/т</span>
            <span className="text-right">К вчера</span>
            <span className="text-right">Готовы отгрузить</span>
            <span className="text-right">Обновлено</span>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredRows.map((r, i) => {
              const st = r.stats!;
              const width = 18 + ((st.index - data!.rowMin) / Math.max(1, data!.rowMax - data!.rowMin)) * 82;
              const selected = region === r.regionId;
              return (
                <button
                  key={r.regionId}
                  onClick={() => pickRegion(r.regionId)}
                  className={"w-full text-left px-3 py-3 rounded-xl transition-colors " + (selected ? "bg-[#f3f8ee]" : "hover:bg-gray-50")}
                >
                  {/* Телефон: компактная строка */}
                  <span className="flex md:hidden items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{REGION_BY_ID[r.regionId].name}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-gray-400 mt-0.5">
                        <span>{st.count} предпр.</span>
                        <Change value={r.change} />
                        {i === 0 && !query && <span className="text-[#2f7a1f] font-medium">дешевле всего</span>}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold tabular-nums text-gray-900">{rub(st.index)} ₽</span>
                      <span className="block text-xs tabular-nums text-gray-500">{tons(st.volume)}</span>
                    </span>
                  </span>

                  {/* Десктоп: таблица */}
                  <span className="hidden md:grid grid-cols-[1.4fr_1.6fr_0.7fr_0.8fr_0.6fr] gap-x-4 items-center">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{REGION_BY_ID[r.regionId].name}</span>
                      <span className="block text-xs text-gray-400">
                        {REGION_BY_ID[r.regionId].macro} · {st.count} предпр.
                        {i === 0 && !query && <span className="ml-1.5 text-[#2f7a1f] font-medium">дешевле всего</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <motion.span className="block h-full rounded-full bg-[#8CC152]" animate={{ width: `${width}%` }} transition={{ duration: 0.5 }} />
                      </span>
                      <span className="text-sm font-bold tabular-nums text-gray-900 w-16 text-right">{rub(st.index)}</span>
                    </span>
                    <span className="text-right text-xs">
                      <Change value={r.change} />
                    </span>
                    <span className="text-right text-sm tabular-nums text-gray-700">{tons(st.volume)}</span>
                    <span className="text-right text-xs tabular-nums text-gray-400">{r.updatedAt ? time(r.updatedAt) : "—"}</span>
                  </span>
                </button>
              );
            })}
            {filteredRows.length === 0 && <p className="text-sm text-gray-400 px-3 py-6">Ничего не найдено</p>}
          </div>
        </div>

        {/* 5. Действие */}
        <div className="mt-4 rounded-2xl bg-[#1F5A25] text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <p className="text-xl md:text-2xl font-semibold">Нужен объём по этой цене?</p>
            <p className="text-white/75 mt-1 text-sm md:text-base">Соберём партию у производителей из подходящих регионов и доставим до порта или границы.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              onClick={() => openLead("exporter")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#1F5A25] px-5 py-3 font-semibold hover:bg-[#f3f8ee] transition-colors"
            >
              Оставить заявку <ArrowRight size={17} />
            </button>
            <a
              href={botHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/30 px-5 py-3 font-medium text-white hover:bg-white/10 transition-colors"
            >
              Я производитель — подать цену
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
