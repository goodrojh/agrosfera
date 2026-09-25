"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  ChevronRight,
  Minus,
  Search,
  Send,
  ShieldCheck,
  Train,
  X,
} from "lucide-react";
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
import { DIRECTIONS, DIRECTION_BY_ID, REGION_BY_ID, type DirectionId } from "@/lib/market/regions";
import { ago, dateLong, pct, rub, time, tons } from "@/lib/market/format";
import { asset } from "@/lib/config";

const CROPS = [
  { name: "Лён масличный", live: true },
  { name: "Подсолнечник" },
  { name: "Рапс" },
  { name: "Соя" },
  { name: "Горчица" },
  { name: "Пшеница" },
  { name: "Ячмень" },
  { name: "Нут" },
];

const RANGES = [
  { id: "day", label: "Сегодня", days: 1 },
  { id: "7", label: "7 дн", days: 7 },
  { id: "30", label: "30 дн", days: 30 },
  { id: "90", label: "90 дн", days: 90 },
] as const;

function Change({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={"text-white/30 " + className}>—</span>;
  const up = value > 0.0005;
  const down = value < -0.0005;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 tabular-nums " +
        (up ? "text-[#A6D86C]" : down ? "text-[#F08A76]" : "text-white/45") +
        " " +
        className
      }
    >
      {up ? <ArrowUpRight size={12} /> : down ? <ArrowDownRight size={12} /> : <Minus size={12} />}
      {pct(value)}
    </span>
  );
}

function LiveClock({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{since ? ago(since, now) : "—"}</>;
}

export default function Terminal() {
  const { ready, mode, connected, companies, companyById, today, history, latest, lastEventAt } = useMarket();
  const [direction, setDirection] = useState<DirectionId | "all">("all");
  const [region, setRegion] = useState<Scope["region"]>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("day");
  const [query, setQuery] = useState("");
  // «Сейчас» для рынка — время последнего события: так расчёт остаётся чистой функцией данных
  const nowTs = lastEventAt;

  const scope: Scope = { direction, region };

  const data = useMemo(() => {
    if (!ready) return null;
    const inS = [...latest.values()].filter((q) => inScope(q.regionId, scope));
    const stats = computeIndex(inS);
    const prevDay = lastHistoryDay(history);
    const prevStats = computeIndex(history.filter((h) => h.day === prevDay && inScope(h.regionId, scope)));
    const rangeDef = RANGES.find((r) => r.id === range)!;
    const series =
      range === "day" ? intradaySeries(today, scope, region ? 1 : 5) : dailySeries(history, latest, scope, rangeDef.days, nowTs);
    const rows = regionRows(latest, history, direction)
      .filter((r) => REGION_BY_ID[r.regionId].name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => (a.stats?.index ?? Infinity) - (b.stats?.index ?? Infinity));
    const scopeCompanies = companies.filter((c) => inScope(c.regionId, scope));
    const todayScoped = today.filter((q) => inScope(q.regionId, scope));
    const feed = [...todayScoped].sort((a, b) => b.at - a.at).slice(0, 10);
    const excludedToday = todayScoped.filter((q) => q.status !== "accepted").length;

    // Объём по макрорегионам
    const byMacro = new Map<string, number>();
    for (const q of inS) {
      const m = REGION_BY_ID[q.regionId].macro;
      byMacro.set(m, (byMacro.get(m) ?? 0) + q.volume);
    }
    const macro = [...byMacro.entries()].sort((a, b) => b[1] - a[1]);

    // Самое дешёвое направление сейчас
    const dirIndex = DIRECTIONS.map((d) => ({
      d,
      s: computeIndex([...latest.values()].filter((q) => REGION_BY_ID[q.regionId].directions.includes(d.id))),
    }));

    return {
      stats,
      prevStats,
      change: stats && prevStats ? stats.index / prevStats.index - 1 : null,
      series,
      rows,
      feed,
      excludedToday,
      submittedToday: inS.length,
      totalCompanies: scopeCompanies.length,
      updatesToday: todayScoped.filter((q) => q.status === "accepted").length,
      macro,
      dirIndex,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, latest, history, today, companies, direction, region, range, query, nowTs]);

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay: 0.4, ease: "easeOut" as const, staggerChildren: 0.08, delayChildren: 0.6 },
    },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  const selectDirection = (d: DirectionId | "all") => {
    setDirection(d);
    setRegion(null);
  };

  const s = data?.stats;
  const rangeSpan = s ? Math.max(1, s.max - s.min) : 1;
  const pos = (v: number) => (s ? ((v - s.min) / rangeSpan) * 100 : 0);

  return (
    <motion.div
      id="terminal"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="w-full max-w-7xl mx-auto rounded-[28px] md:rounded-[40px] overflow-hidden border border-white/10 bg-[#0b1f0e]/55 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row text-white/90 text-left scroll-mt-24"
    >
      {/* Sidebar — культуры */}
      <aside className="w-60 border-r border-white/10 flex-col p-6 hidden lg:flex shrink-0">
        <motion.div variants={itemVariants} className="flex items-center gap-2.5 mb-10 px-2">
          <img src={asset("/brand/emblem.png")} alt="" className="h-8 w-8 rounded-full" />
          <span className="font-semibold tracking-[0.12em] text-sm">АГРОСФЕРА</span>
        </motion.div>

        <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.18em] text-white/35">Культуры</p>
        <nav className="flex-1 space-y-1">
          {CROPS.map((c) => (
            <motion.div key={c.name} variants={itemVariants}>
              <button
                disabled={!c.live}
                className={
                  "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-all " +
                  (c.live ? "bg-white/10 text-white font-medium" : "text-white/35 cursor-default")
                }
              >
                <span className="flex items-center gap-2.5">
                  <span className={"w-1.5 h-1.5 rounded-full " + (c.live ? "bg-[#A6D86C] agr-pulse" : "bg-white/20")} />
                  {c.name}
                </span>
                {!c.live && <span className="text-[10px] text-white/30">скоро</span>}
              </button>
            </motion.div>
          ))}
        </nav>

        <motion.div variants={itemVariants} className="pt-6 border-t border-white/10 space-y-1 mt-6">
          <a href="#instrukciya" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/55 hover:text-white hover:bg-white/5 transition-all">
            <BookOpen size={17} /> Инструкция
          </a>
          <a href="#bot" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/55 hover:text-white hover:bg-white/5 transition-all">
            <Send size={17} /> Подать цену
          </a>
        </motion.div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <motion.header variants={itemVariants} className="min-h-16 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={17} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск региона"
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 md:gap-5 text-xs">
            {mode === "demo" && (
              <span className="rounded-full border border-[#E9C46A]/30 bg-[#E9C46A]/10 text-[#F3D98B] px-2.5 py-1 font-medium">
                демо-данные
              </span>
            )}
            <span className="flex items-center gap-2 text-white/60">
              <span className={"w-2 h-2 rounded-full " + (connected ? "bg-[#A6D86C] agr-pulse" : "bg-[#F08A76]")} />
              <span className="font-semibold text-white">LIVE</span>
              <span className="hidden sm:inline">
                обновлено <LiveClock since={lastEventAt} />
              </span>
            </span>
          </div>
        </motion.header>

        <main className="flex-1 p-4 md:p-8 space-y-5 md:space-y-6">
          <motion.div variants={itemVariants} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Лён масличный</h2>
              <p className="text-xs text-white/45 mt-1">EXW склад предприятия · ₽/т с НДС · медиана цен производителей</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/5 border border-white/10 rounded-lg px-3.5 py-2 text-sm hidden sm:flex items-center gap-2">
                <Calendar size={15} className="text-white/40" />
                <span>{nowTs ? dateLong(nowTs) : "—"}</span>
              </div>
              <motion.a
                href="#zayavka"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="bg-white text-[#0d2410] rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors"
              >
                Нужен объём
                <ChevronRight size={16} />
              </motion.a>
            </div>
          </motion.div>

          {/* Направления экспорта */}
          <motion.div variants={itemVariants} className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/35 shrink-0 mr-1">Направление</span>
            {[{ id: "all" as const, name: "Все" }, ...DIRECTIONS].map((d) => (
              <button
                key={d.id}
                onClick={() => selectDirection(d.id)}
                className={
                  "shrink-0 px-3.5 py-1.5 rounded-full text-sm border transition-all " +
                  (direction === d.id && !region
                    ? "bg-[#A6D86C] text-[#0d2410] border-[#A6D86C] font-semibold"
                    : direction === d.id
                      ? "bg-white/10 border-[#A6D86C]/50 text-white"
                      : "bg-white/5 border-white/10 text-white/65 hover:text-white hover:bg-white/10")
                }
              >
                {d.name}
              </button>
            ))}
            {region && (
              <button
                onClick={() => setRegion(null)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[#A6D86C] text-[#0d2410] font-semibold"
              >
                {REGION_BY_ID[region].name}
                <X size={14} />
              </button>
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 items-stretch">
            {/* Left */}
            <div className="lg:col-span-2 flex flex-col gap-5 md:gap-6 min-w-0">
              {/* Индекс */}
              <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 transition-colors hover:bg-white/[0.07]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white/60 text-sm font-medium">
                    Индекс АгроСферы{region ? ` · ${REGION_BY_ID[region].name}` : direction !== "all" ? ` · ${DIRECTION_BY_ID[direction].name}` : ""}
                  </h3>
                  <span className="text-[11px] text-white/35 tabular-nums">
                    {s ? `${s.count} предпр.` : ""}
                    {s && s.excluded ? ` · исключено ${s.excluded}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mb-6">
                  <span className="text-4xl md:text-[44px] leading-none font-bold tabular-nums tracking-tight">
                    {s ? rub(s.index) : "—"}
                    <span className="text-lg font-medium text-white/50 ml-1.5">₽/т</span>
                  </span>
                  <span className="text-xs text-white/40 mb-1 tabular-nums">
                    вчера {data?.prevStats ? rub(data.prevStats.index) : "—"}
                  </span>
                  <span className="ml-auto text-xs bg-white/5 px-2 py-1 rounded-full">
                    <Change value={data?.change ?? null} />
                  </span>
                </div>
                {/* Диапазон цен: min — P25…P75 — max, маркер — индекс */}
                <div className="relative h-2 w-full bg-white/5 rounded-full">
                  {s && (
                    <>
                      <motion.div
                        className="absolute h-full rounded-full bg-[#A6D86C]/35"
                        animate={{ left: `${pos(s.p25)}%`, width: `${Math.max(2, pos(s.p75) - pos(s.p25))}%` }}
                        transition={{ duration: 0.6 }}
                      />
                      <motion.div
                        className="absolute -top-1 h-4 w-1 rounded-full bg-[#A6D86C] shadow-[0_0_12px_#A6D86C]"
                        animate={{ left: `calc(${pos(s.index)}% - 2px)` }}
                        transition={{ duration: 0.6 }}
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-between mt-3 text-xs tabular-nums">
                  <span className="text-white/40">мин {s ? rub(s.min) : "—"}</span>
                  <span className="text-white/55 text-center">
                    <span className="hidden sm:inline">ядро рынка </span>
                    {s ? `${rub(s.p25)} – ${rub(s.p75)}` : "—"}
                  </span>
                  <span className="text-white/40">макс {s ? rub(s.max) : "—"}</span>
                </div>
              </motion.div>

              {/* График */}
              <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 flex-1 flex flex-col transition-colors hover:bg-white/[0.07] min-w-0">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h3 className="font-semibold">Котировка</h3>
                  <div className="flex bg-white/5 p-1 rounded-lg">
                    {RANGES.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setRange(r.id)}
                        className={
                          "px-2 md:px-3 py-1 text-xs rounded-md transition-all whitespace-nowrap " +
                          (range === r.id ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70")
                        }
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-h-[280px] md:min-h-[320px]">
                  {data && <PriceChart points={data.series} kind={range === "day" ? "intraday" : "daily"} animKey={`${range}-${direction}-${region}`} />}
                </div>
                <p className="mt-3 text-[11px] text-white/35">
                  Линия — медиана цен, полоса — 50% предложений, столбики — свободный объём.
                </p>
              </motion.div>
            </div>

            {/* Right */}
            <div className="flex flex-col gap-5 md:gap-6">
              {/* Объём */}
              <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 transition-colors hover:bg-white/[0.07]">
                <h3 className="font-semibold mb-4">Свободно к отгрузке</h3>
                <div className="flex items-end justify-between mb-6">
                  <span className="text-3xl font-bold tabular-nums">{s ? tons(s.volume) : "—"}</span>
                  <span className="text-xs text-white/45 mb-1">на сегодня</span>
                </div>
                <div className="space-y-3">
                  {data?.macro.map(([name, vol]) => (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/60">{name}</span>
                        <span className="tabular-nums">{tons(vol)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[#A6D86C]/70 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(vol / Math.max(1, s?.volume ?? 1)) * 100}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5 border-t border-white/10 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/55">Подали цену сегодня</span>
                    <span className="font-medium tabular-nums">
                      {data?.submittedToday ?? 0} из {data?.totalCompanies ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/55">Обновлений за день</span>
                    <span className="font-medium tabular-nums">{data?.updatesToday ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/55 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-[#A6D86C]" /> Отсеяно ошибок
                    </span>
                    <span className="font-medium tabular-nums">{data?.excludedToday ?? 0}</span>
                  </div>
                </div>
              </motion.div>

              {/* Направление */}
              <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 transition-colors hover:bg-white/[0.07] flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <Train size={16} className="text-[#A6D86C]" />
                  <h3 className="font-semibold">Логистика</h3>
                </div>
                {direction === "all" ? (
                  <div className="space-y-2.5">
                    {data?.dirIndex
                      .filter((x) => x.s)
                      .sort((a, b) => a.s!.index - b.s!.index)
                      .map(({ d, s: ds }) => (
                        <button
                          key={d.id}
                          onClick={() => selectDirection(d.id)}
                          className="w-full flex items-center justify-between text-left text-sm rounded-lg px-3 py-2 bg-white/[0.03] hover:bg-white/10 transition-colors"
                        >
                          <span className="text-white/75">{d.name}</span>
                          <span className="tabular-nums font-semibold">{rub(ds!.index)}</span>
                        </button>
                      ))}
                    <p className="text-[11px] text-white/35 pt-1">Выберите направление — покажем регионы с самым коротким плечом.</p>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <p className="text-white/80">{DIRECTION_BY_ID[direction].note}</p>
                    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-1.5 text-xs">
                      <p className="text-white/40">Пункты отгрузки</p>
                      <p className="text-white">{DIRECTION_BY_ID[direction].hubs}</p>
                      <p className="text-white/40 pt-1">Транспорт</p>
                      <p className="text-white">{DIRECTION_BY_ID[direction].transport}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Регионы + лента */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-6">
            <motion.div variants={itemVariants} className="lg:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Регионы</h3>
                <span className="text-[11px] text-white/35">по возрастанию цены · нажмите, чтобы отфильтровать</span>
              </div>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-white/35 text-left">
                      <th className="font-medium pb-2">Регион</th>
                      <th className="font-medium pb-2 text-right">Цена, ₽/т</th>
                      <th className="font-medium pb-2 text-right">К вчера</th>
                      <th className="font-medium pb-2 text-right">Объём</th>
                      <th className="font-medium pb-2 text-right">Предпр.</th>
                      <th className="font-medium pb-2 text-right">Обновл.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.rows.map((r) => (
                      <tr
                        key={r.regionId}
                        onClick={() => setRegion(region === r.regionId ? null : r.regionId)}
                        className={
                          "border-t border-white/[0.06] cursor-pointer transition-colors " +
                          (region === r.regionId ? "bg-[#A6D86C]/10" : "hover:bg-white/[0.04]")
                        }
                      >
                        <td className="py-2.5 pr-2">
                          <span className="text-white/90">{REGION_BY_ID[r.regionId].name}</span>
                          <span className="block text-[10px] text-white/35">{REGION_BY_ID[r.regionId].macro}</span>
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">{r.stats ? rub(r.stats.index) : "—"}</td>
                        <td className="py-2.5 text-right text-xs">
                          <Change value={r.change} />
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-white/75">{r.stats ? tons(r.stats.volume) : "—"}</td>
                        <td className="py-2.5 text-right tabular-nums text-white/55">{r.stats?.count ?? 0}</td>
                        <td className="py-2.5 text-right tabular-nums text-white/45 text-xs">{r.updatedAt ? time(r.updatedAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Лента подач</h3>
                <span className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A6D86C] agr-pulse" /> из бота
                </span>
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {data?.feed.map((q) => {
                    const c = companyById.get(q.companyId);
                    const bad = q.status !== "accepted";
                    return (
                      <motion.li
                        key={q.id}
                        layout
                        initial={{ opacity: 0, y: -12, backgroundColor: "rgba(166,216,108,0.18)" }}
                        animate={{ opacity: 1, y: 0, backgroundColor: "rgba(255,255,255,0.03)" }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="rounded-xl px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-white/45 truncate">
                            {c?.code ?? "—"} · {REGION_BY_ID[q.regionId].name}
                          </span>
                          <span className="text-white/35 tabular-nums shrink-0">{time(q.at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className={"text-sm font-semibold tabular-nums " + (bad ? "line-through text-white/35" : "")}>
                            {rub(q.price)} ₽/т <span className="font-normal text-white/50">· {tons(q.volume)}</span>
                          </span>
                          {bad ? (
                            <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#F08A76]/15 text-[#F5A897] shrink-0">
                              {q.status === "moderation" ? "на проверке" : "не принято"}
                            </span>
                          ) : q.revision > 1 ? (
                            <span className="text-[10px] rounded-full px-2 py-0.5 bg-white/10 text-white/70 shrink-0">
                              обновление{q.prevPrice ? ` · было ${rub(q.prevPrice)}` : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#A6D86C]/15 text-[#C3E79A] shrink-0">новая</span>
                          )}
                        </div>
                        {bad && q.note && <p className="text-[11px] text-white/40 mt-1">{q.note}</p>}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </motion.div>
          </div>
        </main>
      </div>
    </motion.div>
  );
}
