"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BookOpen, Map as MapIcon, Minus, Search, X } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import PriceChart, { type ChartSeries } from "@/components/market/PriceChart";
import RussiaMap from "@/components/market/RussiaMap";
import RegionPicker, { plural } from "@/components/market/RegionPicker";
import LeadDialog from "@/components/market/LeadDialog";
import GuideDialog from "@/components/market/GuideDialog";
import { computeIndex, dailySeries, inScope, intradaySeries, type IndexStats, type Scope } from "@/lib/market/aggregate";
import { CROPS, CROP_BY_ID, type CropId, type QualitySpec } from "@/lib/market/crops";
import { REGIONS, REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { ago, pct, rub, time } from "@/lib/market/format";
import type { DailyClose, Quote } from "@/lib/market/types";


const PERIODS = [
  { id: "day", label: "День", days: 1 },
  { id: "7", label: "Неделя", days: 7 },
  { id: "30", label: "Месяц", days: 30 },
  { id: "90", label: "3 мес", days: 90 },
] as const;

/** Цвета линий регионов на графике; первая — фирменная */
const COLORS = ["#1F5A25", "#d9822b", "#2f6fb0", "#9b4dca", "#c0392b"];
const MAX_LINES = COLORS.length;

function Change({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-gray-400">—</span>;
  const up = value > 0.0005;
  const down = value < -0.0005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={"inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums " + (up ? "text-[#2f7a1f]" : down ? "text-[#c0492f]" : "text-gray-500")}>
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

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** «сегодня 08:14», «вчера 09:30», «2 дня назад» */
function updatedLabel(at: number, now: number): { text: string; fresh: boolean } {
  const today = startOfDay(now);
  if (at >= today) return { text: `сегодня ${time(at)}`, fresh: true };
  if (at >= today - 86_400_000) return { text: `вчера ${time(at)}`, fresh: false };
  return { text: "2 дня назад", fresh: false };
}

const pctCell = (n?: number) => (n === undefined ? "—" : `${String(n).replace(".", ",")}%`);

function ChartPanel({ recent, history, now, regions }: { recent: Quote[]; history: DailyClose[]; now: number; regions: RegionId[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("day");
  const lineRegions = regions.slice(0, MAX_LINES);

  // Ряды пересчитывает React Compiler только при изменении входных данных
  const days = PERIODS.find((x) => x.id === period)!.days;
  const build = (scope: Scope, minCount: number) =>
    period === "day" ? intradaySeries(recent, scope, startOfDay(now), now, minCount) : dailySeries(history, recent, scope, days, now, minCount);
  const series: ChartSeries[] = !lineRegions.length
    ? [{ id: "all", label: "Вся Россия", color: COLORS[0], points: build({ regions: [] }, 3) }]
    : lineRegions.map((r, i) => ({ id: r, label: REGION_BY_ID[r].name, color: COLORS[i], points: build({ regions: [r] }, 1) }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="text-gray-400">Средняя цена предложений, ₽/т</span>
          {series.length > 1 &&
            series.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          {regions.length > MAX_LINES && <span className="text-gray-400">на графике — первые {MAX_LINES} регионов</span>}
        </div>
        <div className="flex bg-gray-100 p-0.5 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={"px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors " + (period === p.id ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[200px] md:h-[230px] mt-2">
        <PriceChart series={series} kind={period === "day" ? "intraday" : "daily"} animKey={`${period}-${lineRegions.join(",")}`} />
      </div>
    </div>
  );
}

/** Сводка предложений партнёров: без названий предприятий */
function OffersTable({ offers, quality, now, onLead }: { offers: Quote[]; quality: QualitySpec | null; now: number; onLead: (q: Quote) => void }) {
  const [sort, setSort] = useState<"price" | "volume" | "fresh">("price");
  const rows = useMemo(
    () => [...offers].sort((a, b) => (sort === "price" ? a.price - b.price : sort === "volume" ? b.volume - a.volume : b.at - a.at)),
    [offers, sort]
  );
  const sortBtn = (id: typeof sort, label: string) => (
    <button onClick={() => setSort(id)} className={"px-2 py-1 rounded-md " + (sort === id ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")}>
      {label}
    </button>
  );

  if (!rows.length) {
    return <div className="py-10 text-center text-sm text-gray-500">По выбранным регионам сейчас нет предложений. Оставьте запрос — подберём объём у партнёров.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-gray-900">Предложения партнёров</p>
        <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs">
          {sortBtn("price", "Дешевле")}
          {sortBtn("volume", "Больше объём")}
          {sortBtn("fresh", "Свежие")}
        </div>
      </div>

      {/* Компьютер: таблица */}
      <table className="hidden md:table w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="font-normal py-2 pr-3">Регион</th>
            <th className="font-normal py-2 px-3 text-right">Объём</th>
            <th className="font-normal py-2 px-3 text-right">Влажность</th>
            <th className="font-normal py-2 px-3 text-right">Сорная примесь</th>
            {quality && <th className="font-normal py-2 px-3 text-right">{quality.label}</th>}
            <th className="font-normal py-2 px-3 text-right">Цена, ₽/т</th>
            <th className="font-normal py-2 px-3">Обновлено</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((q) => {
            const u = updatedLabel(q.at, now);
            return (
              <tr key={q.id} className="border-b border-gray-50 hover:bg-[#f8faf6] transition-colors">
                <td className="py-2.5 pr-3 text-gray-900">{REGION_BY_ID[q.regionId].name}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{rub(q.volume)} т</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{pctCell(q.moisture)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{pctCell(q.impurity)}</td>
                {quality && <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{pctCell(q.quality)}</td>}
                <td className="py-2.5 px-3 text-right tabular-nums font-bold text-gray-900">{rub(q.price)}</td>
                <td className={"py-2.5 px-3 text-xs whitespace-nowrap " + (u.fresh ? "text-[#2f7a1f]" : "text-gray-400")}>{u.text}</td>
                <td className="py-2 pl-3 text-right">
                  <button onClick={() => onLead(q)} className="rounded-lg bg-[#1F5A25] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#174a1c] whitespace-nowrap">
                    Оставить заявку
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Телефон: карточки */}
      <div className="md:hidden divide-y divide-gray-100">
        {rows.map((q) => {
          const u = updatedLabel(q.at, now);
          return (
            <div key={q.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-gray-900">{REGION_BY_ID[q.regionId].name}</p>
                <p className="text-base font-bold tabular-nums">{rub(q.price)} ₽/т</p>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 tabular-nums">
                {rub(q.volume)} т · влажн. {pctCell(q.moisture)} · сорн. {pctCell(q.impurity)}
                {quality ? ` · ${quality.short.toLowerCase()} ${pctCell(q.quality)}` : ""}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className={"text-xs " + (u.fresh ? "text-[#2f7a1f]" : "text-gray-400")}>{u.text}</span>
                <button onClick={() => onLead(q)} className="rounded-lg bg-[#1F5A25] text-white px-3 py-1.5 text-xs font-semibold">
                  Оставить заявку
                </button>
              </div>
            </div>
          );
        })}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Выбор регионов на карте">
      {/* Окно всегда помещается в экран: карта вписывается в свободную высоту, кнопки видны без прокрутки */}
      <div className="w-full max-w-5xl h-full max-h-[820px] flex flex-col rounded-2xl bg-white p-5 md:p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-lg font-semibold text-gray-900">Выберите регионы</p>
            <p className="text-sm text-gray-500">Нажимайте на регионы, чтобы отметить несколько. Чем темнее, тем дешевле; серые — нет предприятий.</p>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <RussiaMap stats={stats} selected={draft} onToggle={toggle} />
        </div>

        <div className="shrink-0 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 border-t border-gray-100 pt-4">
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
            <button onClick={() => onApply(draft)} className="rounded-xl bg-[#1F5A25] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#174a1c]">
              Применить{draft.length ? ` (${draft.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Сводка: график цен и предложения предприятий-партнёров с кнопкой заявки */
export default function Terminal() {
  const { ready, mode, crop, setCrop, recent, history, offers, now, lastEventAt } = useMarket();
  const [regions, setRegions] = useState<RegionId[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const closeMap = useCallback(() => setMapOpen(false), []);
  const [lead, setLead] = useState<{ offer?: Quote } | null>(null);
  const closeLead = useCallback(() => setLead(null), []);
  const [guideOpen, setGuideOpen] = useState(false);
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const cropInfo = CROP_BY_ID[crop];


  const scope = useMemo<Scope>(() => ({ regions }), [regions]);
  const scoped = useMemo(() => offers.filter((q) => inScope(q.regionId, scope)), [offers, scope]);

  const summary = useMemo(() => {
    if (!ready) return null;
    const stats = computeIndex(scoped);
    const days = dailySeries(history, recent, scope, 2, now);
    const prev = days.length >= 2 ? days[days.length - 2] : null;
    const regionStats = new Map<RegionId, IndexStats>();
    for (const r of REGIONS) {
      const st = computeIndex(offers.filter((q) => q.regionId === r.id));
      if (st) regionStats.set(r.id, st);
    }
    return { stats, change: stats && prev ? stats.index / prev.index - 1 : null, volume: scoped.reduce((s, q) => s + q.volume, 0), regionStats };
  }, [ready, scoped, history, recent, scope, offers, now]);

  const chooseCrop = (c: CropId) => {
    setCrop(c);
    setRegions((prev) => prev.filter((r) => CROP_BY_ID[c].regions.includes(r)));
  };

  const s = summary?.stats;

  return (
    <section id="terminal" className="bg-white py-6 md:py-8 px-4 md:px-8 scroll-mt-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-[28px] md:text-[34px] font-semibold tracking-tight text-[#111] leading-none">Сводка предложений</h2>
            <button
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1F5A25]/25 bg-[#f3f8ee] px-3.5 py-1.5 text-sm font-semibold text-[#1F5A25] hover:bg-[#e6f0dc] transition-colors"
            >
              <BookOpen size={15} /> Инструкция
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {mode === "demo" && <span className="rounded-full bg-amber-50 text-amber-800 px-3 py-1 font-medium">демо-данные</span>}
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f3f8ee] text-[#1F5A25] px-3 py-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f9a2a] agr-pulse" />
              обновлено <LiveAgo since={lastEventAt} />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5 items-start">
          {/* Культуры — вертикальный список сбоку (на телефоне — строка) */}
          <nav aria-label="Культура" className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:sticky lg:top-4">
            {CROPS.map((c) => {
              const on = crop === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => chooseCrop(c.id)}
                  aria-current={on}
                  className={"shrink-0 text-left rounded-xl px-4 py-2.5 text-sm font-medium transition-colors " + (on ? "bg-[#1F5A25] text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")}
                >
                  {c.name}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 rounded-2xl border border-[#e6ebe1] bg-white shadow-[0_1px_3px_rgba(16,40,20,0.05)]">
            {/* Шапка окна: культура, средняя цена, объём, регионы */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-base font-semibold text-gray-900">{cropInfo.name}</p>
                  <p className="text-2xl font-bold tabular-nums text-[#111]">{s ? `${rub(s.index)} ₽/т` : "—"}</p>
                  <Change value={summary?.change ?? null} />
                  <span className="text-xs text-gray-400">к вчера</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                  {scoped.length} {plural(scoped.length, ["предложение", "предложения", "предложений"])} · свободно {rub(summary?.volume ?? 0)} т
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RegionPicker value={regions} onChange={setRegions} stats={summary?.regionStats ?? new Map()} available={cropInfo.regions} />
                <button
                  onClick={() => setMapOpen(true)}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:border-[#1F5A25]/40 hover:text-[#1F5A25] transition-colors"
                >
                  <MapIcon size={16} />
                  <span className="hidden sm:inline">На карте</span>
                </button>
              </div>
            </div>

            <div className="px-5 pt-4">{ready && <ChartPanel recent={recent} history={history} now={now} regions={regions} />}</div>

            <div className="px-5 pt-5 pb-5 mt-3 border-t border-gray-100">
              {ready && <OffersTable offers={scoped} quality={cropInfo.quality} now={now} onLead={(offer) => setLead({ offer })} />}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl bg-[#f6f8f3] px-4 py-3">
                <p className="text-sm text-gray-600 text-center sm:text-left">Не нашли нужного объёма или качества? Подберём у партнёров под ваш запрос.</p>
                <button onClick={() => setLead({})} className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-[#1F5A25]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1F5A25] hover:bg-[#f3f8ee]">
                  <Search size={15} /> Оставить запрос
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mapOpen && summary && (
        <MapDialog
          stats={summary.regionStats}
          initial={regions}
          onApply={(ids) => {
            setRegions(ids);
            setMapOpen(false);
          }}
          onClose={closeMap}
        />
      )}
      {guideOpen && <GuideDialog onClose={closeGuide} />}
      {lead && <LeadDialog offer={lead.offer} crop={crop} regions={regions} onClose={closeLead} />}
    </section>
  );
}
