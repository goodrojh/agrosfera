// Расчёт индекса: медиана вместо среднего + отсечение выбросов по MAD.
// Одна ошибочная цена не может сдвинуть котировку.

import { REGIONS, REGION_BY_ID, type DirectionId, type RegionId } from "./regions";
import type { DailyClose, Quote } from "./types";

export interface Scope {
  direction: DirectionId | "all";
  region: RegionId | null;
  /** Несколько выбранных регионов (приоритетнее region и direction) */
  regions?: RegionId[];
}

export interface IndexStats {
  /** Медиана принятых цен после отсечения выбросов */
  index: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  /** Суммарный свободный объём, т */
  volume: number;
  /** Число предприятий в расчёте */
  count: number;
  /** Исключено как выбросы */
  excluded: number;
}

export interface SeriesPoint extends IndexStats {
  t: number;
  key: string;
}

export function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Порог выброса: 3.5 робастных σ, но не уже ±25% от медианы (регионы реально различаются) */
export function outlierBand(med: number, mad: number): number {
  return Math.max(3.5 * 1.4826 * mad, med * 0.25);
}

export function computeIndex(points: { price: number; volume: number }[]): IndexStats | null {
  if (points.length === 0) return null;
  const prices = points.map((p) => p.price).sort((a, b) => a - b);
  const med = median(prices);
  const mad = median(prices.map((p) => Math.abs(p - med)).sort((a, b) => a - b));
  const band = outlierBand(med, mad);
  const kept = points.filter((p) => Math.abs(p.price - med) <= band);
  if (kept.length === 0) return null;
  const k = kept.map((p) => p.price).sort((a, b) => a - b);
  return {
    index: Math.round(median(k)),
    min: k[0],
    max: k[k.length - 1],
    p25: Math.round(quantile(k, 0.25)),
    p75: Math.round(quantile(k, 0.75)),
    volume: kept.reduce((s, p) => s + p.volume, 0),
    count: kept.length,
    excluded: points.length - kept.length,
  };
}

export function inScope(regionId: RegionId, scope: Scope): boolean {
  if (scope.regions?.length) return scope.regions.includes(regionId);
  if (scope.region) return regionId === scope.region;
  if (scope.direction === "all") return true;
  return REGION_BY_ID[regionId].directions.includes(scope.direction);
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Последняя принятая подача каждого предприятия за сегодня */
export function latestAccepted(today: Quote[]): Map<string, Quote> {
  const map = new Map<string, Quote>();
  for (const q of today) {
    if (q.status !== "accepted") continue;
    const cur = map.get(q.companyId);
    if (!cur || q.at >= cur.at) map.set(q.companyId, q);
  }
  return map;
}

export function lastHistoryDay(history: DailyClose[]): string | null {
  let max: string | null = null;
  for (const h of history) if (!max || h.day > max) max = h.day;
  return max;
}

/** Дневной ряд: история + сегодняшняя точка, пересчитываемая в реальном времени */
export function dailySeries(
  history: DailyClose[],
  latest: Map<string, Quote>,
  scope: Scope,
  days: number,
  now: number
): SeriesPoint[] {
  const byDay = new Map<string, { price: number; volume: number }[]>();
  for (const h of history) {
    if (!inScope(h.regionId, scope)) continue;
    let arr = byDay.get(h.day);
    if (!arr) byDay.set(h.day, (arr = []));
    arr.push({ price: h.price, volume: h.volume });
  }
  const keys = [...byDay.keys()].sort().slice(-(days - 1));
  const out: SeriesPoint[] = [];
  for (const key of keys) {
    const stats = computeIndex(byDay.get(key)!);
    if (stats) out.push({ ...stats, key, t: new Date(key + "T12:00:00").getTime() });
  }
  const todayPts = [...latest.values()].filter((q) => inScope(q.regionId, scope));
  const todayStats = computeIndex(todayPts);
  if (todayStats) out.push({ ...todayStats, key: dayKey(now), t: now });
  return out;
}

/** Внутридневной ряд: индекс после каждой принятой подачи.
 *  Линия начинается, когда цену прислали хотя бы minCount предприятий — иначе первые подачи дают ложный скачок. */
export function intradaySeries(today: Quote[], scope: Scope, minCount = 5): SeriesPoint[] {
  const sorted = today
    .filter((q) => q.status === "accepted" && inScope(q.regionId, scope))
    .sort((a, b) => a.at - b.at);
  const current = new Map<string, { price: number; volume: number }>();
  const out: SeriesPoint[] = [];
  for (const q of sorted) {
    current.set(q.companyId, { price: q.price, volume: q.volume });
    if (current.size < minCount) continue;
    const stats = computeIndex([...current.values()]);
    if (stats) out.push({ ...stats, key: q.id, t: q.at });
  }
  return out;
}

export interface RegionRow {
  regionId: RegionId;
  stats: IndexStats | null;
  change: number | null;
  updatedAt: number | null;
}

export function regionRows(
  latest: Map<string, Quote>,
  history: DailyClose[],
  direction: DirectionId | "all"
): RegionRow[] {
  const prevDay = lastHistoryDay(history);
  return REGIONS.filter((r) => direction === "all" || r.directions.includes(direction)).map((r) => {
    const pts = [...latest.values()].filter((q) => q.regionId === r.id);
    const stats = computeIndex(pts);
    const prev = computeIndex(history.filter((h) => h.day === prevDay && h.regionId === r.id));
    return {
      regionId: r.id,
      stats,
      change: stats && prev ? stats.index / prev.index - 1 : null,
      updatedAt: pts.length ? Math.max(...pts.map((p) => p.at)) : null,
    };
  });
}

/** Опорная цена для проверки новой подачи: медиана региона (от 3 предприятий), иначе рынка */
export function referenceInfo(
  latest: Map<string, Quote>,
  regionId: RegionId,
  excludeCompany?: string
): { price: number; scope: "region" | "market" } | undefined {
  const all = [...latest.values()].filter((q) => q.companyId !== excludeCompany);
  const region = all.filter((q) => q.regionId === regionId);
  const useRegion = region.length >= 3;
  const stats = computeIndex(useRegion ? region : all);
  return stats ? { price: stats.index, scope: useRegion ? "region" : "market" } : undefined;
}

export function referencePrice(latest: Map<string, Quote>, regionId: RegionId, excludeCompany?: string): number | undefined {
  return referenceInfo(latest, regionId, excludeCompany)?.price;
}
