"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Map as MapIcon, Minus, X } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import PriceChart from "@/components/market/PriceChart";
import RussiaMap from "@/components/market/RussiaMap";
import RegionPicker from "@/components/market/RegionPicker";
import OrderBook from "@/components/market/OrderBook";
import { computeIndex, dailySeries, inScope, intradaySeries, lastHistoryDay, type IndexStats, type Scope } from "@/lib/market/aggregate";
import { CROPS, CROP_BY_ID, type CropId } from "@/lib/market/crops";
import { REGIONS, REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { ago, pct, rub, tons } from "@/lib/market/format";
import type { DailyClose, Quote } from "@/lib/market/types";
import { openLead } from "@/lib/lead";

const PERIODS = [
  { id: "day", label: "День", days: 1 },
  { id: "7", label: "Неделя", days: 7 },
  { id: "30", label: "Месяц", days: 30 },
  { id: "90", label: "3 мес", days: 90 },
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">График</p>
          <p className="text-xs text-gray-400">средняя цена, ₽/т</p>
        </div>
        <div className="flex bg-gray-100 p-0.5 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={
                "px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors " +
                (period === p.id ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-[300px] mt-4">
        <PriceChart points={series} kind={period === "day" ? "intraday" : "daily"} animKey={`${period}-${(scope.regions ?? []).join(",")}`} />
      </div>
    </div>
  );
}

/** Карта во всплывающем окне: отмечаете несколько регионов и нажимаете «Применить» */
function MapDialog({
  stats,
  initial,
  onApply,
  onClose,
}: {
  stats: Map<RegionId, IndexStats>;
  initial: RegionId[];
  onApply: (ids: RegionId[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RegionId[]>(initial);
  const toggle = useCallback((id: RegionId) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id])), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Выбор регионов на карте"
    >
      <div className="w-full max-w-5xl max-h-full overflow-y-auto rounded-2xl bg-white p-5 md:p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-lg font-semibold text-gray-900">Выберите регионы</p>
            <p className="text-sm text-gray-500">Нажимайте на регионы, чтобы отметить несколько. Чем темнее, тем дешевле; серые — нет производителей.</p>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <RussiaMap stats={stats} selected={draft} onToggle={toggle} />

        <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap gap-2 min-h-[32px] items-center">
            {draft.length === 0 && <span className="text-sm text-gray-400">Ничего не выбрано — будут показаны все регионы</span>}
            {draft.map((id) => (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f8ee] text-[#1F5A25] px-3 py-1 text-sm hover:bg-[#e6f0dc]"
              >
                {REGION_BY_ID[id].name}
                <X size={13} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {draft.length > 0 && (
              <button onClick={() => setDraft([])} className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-800">
                Сбросить
              </button>
            )}
            <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Отмена
            </button>
            <button
              onClick={() => onApply(draft)}
              className="rounded-xl bg-[#1F5A25] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#174a1c]"
            >
              Применить{draft.length ? ` (${draft.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Terminal() {
  const { ready, mode, crop, setCrop, supported, companies, today, history, latest, lastEventAt } = useMarket();
  const [regions, setRegions] = useState<RegionId[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const closeMap = useCallback(() => setMapOpen(false), []);

  const scope = useMemo<Scope>(() => ({ direction: "all", region: null, regions }), [regions]);
  const cropInfo = CROP_BY_ID[crop];

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
    const total = companies.filter((c) => inScope(c.regionId, scope)).length;
    return { inS, stats, change: stats && prevStats ? stats.index / prevStats.index - 1 : null, regionStats, total };
  }, [ready, latest, prevCloses, companies, scope]);

  const chooseCrop = (c: CropId) => {
    setCrop(c);
    // Регионы, где новой культуры нет, из выбора убираем
    setRegions((prev) => prev.filter((r) => CROP_BY_ID[c].regions.includes(r)));
  };

  const s = live?.stats;
  const minCount = regions.length ? 1 : Math.max(3, Math.round((live?.total ?? 0) * 0.35));

  return (
    <section id="terminal" className="bg-white py-16 md:py-24 px-4 md:px-8 scroll-mt-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 items-start">
          {/* Культуры — вертикальный список сбоку (на телефоне — строка) */}
          <nav aria-label="Культура" className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:sticky lg:top-6">
            {CROPS.map((c) => {
              const on = crop === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => chooseCrop(c.id)}
                  aria-current={on}
                  className={
                    "shrink-0 text-left rounded-xl px-4 py-2.5 text-sm font-medium transition-colors " +
                    (on ? "bg-[#1F5A25] text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
                  }
                >
                  {c.name}
                  {mode === "live" && !c.live && <span className="ml-1.5 text-[11px] opacity-60">скоро</span>}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {!supported ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-xl font-semibold text-gray-900">{cropInfo.name}: подключаем производителей</p>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">Котировки появятся, как только предприятия начнут присылать цены в бот.</p>
                <button onClick={() => openLead("producer")} className="mt-6 rounded-xl bg-[#1F5A25] text-white px-5 py-3 font-semibold hover:bg-[#174a1c]">
                  Подключить предприятие
                </button>
              </div>
            ) : (
              <>
                {/* Окно терминала */}
                <div className="rounded-2xl border border-[#e6ebe1] shadow-[0_1px_3px_rgba(16,40,20,0.05)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 md:px-6 py-4 border-b border-gray-100">
                    <p className="text-lg font-semibold text-gray-900">{cropInfo.name}</p>
                    <div className="flex items-center gap-2">
                      <RegionPicker value={regions} onChange={setRegions} stats={live?.regionStats ?? new Map()} available={cropInfo.regions} />
                      <button
                        onClick={() => setMapOpen(true)}
                        className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:border-[#1F5A25]/40 hover:text-[#1F5A25] transition-colors"
                      >
                        <MapIcon size={16} />
                        <span className="hidden sm:inline">На карте</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 xl:divide-x divide-gray-100">
                    <div className="p-5 md:p-6 min-w-0">{live && <OrderBook quotes={live.inS} />}</div>
                    <div className="p-5 md:p-6 min-w-0 border-t xl:border-t-0 border-gray-100">
                      {live && <ChartPanel today={today} history={history} latest={latest} scope={scope} nowTs={lastEventAt} minCount={minCount} />}
                    </div>
                  </div>
                </div>

                {/* Сводка — компактно под окном */}
                <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 px-1 text-sm text-gray-500">
                  <span>
                    Средняя <b className="text-gray-900 tabular-nums">{s ? `${rub(s.index)} ₽/т` : "—"}</b> <Change value={live?.change ?? null} />
                  </span>
                  <span>
                    Разброс <b className="text-gray-900 tabular-nums">{s ? `${rub(s.min)} – ${rub(s.max)}` : "—"}</b>
                  </span>
                  <span>
                    Готовы отгрузить <b className="text-gray-900 tabular-nums">{s ? tons(s.volume) : "—"}</b>
                  </span>
                  <span>
                    Предприятий <b className="text-gray-900 tabular-nums">{live?.inS.length ?? 0}</b> из {live?.total ?? 0}
                  </span>
                  <button
                    onClick={() => openLead("exporter")}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#1F5A25] text-white px-4 py-2 font-semibold hover:bg-[#174a1c] transition-colors"
                  >
                    Нужен объём <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {mapOpen && live && (
        <MapDialog
          stats={live.regionStats}
          initial={regions}
          onApply={(ids) => {
            setRegions(ids);
            setMapOpen(false);
          }}
          onClose={closeMap}
        />
      )}
    </section>
  );
}
