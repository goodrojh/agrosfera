// Расчёт индекса: медиана вместо среднего + отсечение выбросов по MAD.
// Одна ошибочная цена не может сдвинуть котировку.

import type { RegionId } from "./regions";
import type { DailyClose, Quote } from "./types";

/** Какие регионы смотрим; пусто — вся Россия */
export interface Scope {
  regions: RegionId[];
}

/** Предложение висит в сводке до нового ответа предприятия, но не дольше 3 дней */
export const OFFER_TTL = 72 * 3600_000;

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

export interface SeriesPoint {
  t: number;
  index: number;
  count: number;
  volume: number;
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
  return scope.regions.length === 0 || scope.regions.includes(regionId);
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const shiftDay = (key: string, n: number) => dayKey(new Date(key + "T12:00:00").getTime() + n * 86_400_000);

/** Последняя принятая цена каждого предприятия в списке */
export function latestAccepted(quotes: Quote[]): Map<string, Quote> {
  const map = new Map<string, Quote>();
  for (const q of quotes) {
    if (q.status !== "accepted") continue;
    const cur = map.get(q.companyId);
    if (!cur || q.at >= cur.at) map.set(q.companyId, q);
  }
  return map;
}

/**
 * Действующие предложения на момент t: последний ответ каждого предприятия за 3 дня.
 * Ответ «сегодня нет в продаже» снимает предложение; цены на проверке не показываются.
 */
export function activeOffers(quotes: Quote[], t: number): Quote[] {
  const last = new Map<string, Quote>();
  for (const q of quotes) {
    if (q.at > t || q.at < t - OFFER_TTL || (q.status !== "accepted" && q.status !== "withdrawn")) continue;
    const cur = last.get(q.companyId);
    if (!cur || q.at >= cur.at) last.set(q.companyId, q);
  }
  return [...last.values()].filter((q) => q.status === "accepted");
}

export function lastHistoryDay(history: DailyClose[]): string | null {
  let max: string | null = null;
  for (const h of history) if (!max || h.day > max) max = h.day;
  return max;
}

const point = (t: number, pts: { price: number; volume: number }[]): SeriesPoint | null => {
  const s = computeIndex(pts);
  return s ? { t, index: s.index, count: s.count, volume: s.volume } : null;
};

/**
 * За день: индекс с начала суток и после каждого ответа предприятий.
 * Предложения прошлых дней учитываются, пока действуют (до 3 дней).
 */
export function intradaySeries(quotes: Quote[], scope: Scope, dayStart: number, now: number, minCount = 1): SeriesPoint[] {
  const own = quotes.filter((q) => inScope(q.regionId, scope));
  const times = [dayStart, ...own.filter((q) => q.at > dayStart && q.at <= now && (q.status === "accepted" || q.status === "withdrawn")).map((q) => q.at), now]
    .sort((a, b) => a - b)
    .filter((t, i, arr) => i === 0 || t !== arr[i - 1]);
  const out: SeriesPoint[] = [];
  for (const t of times) {
    const offers = activeOffers(own, t);
    if (offers.length < minCount) continue;
    const p = point(t, offers);
    if (p) out.push(p);
  }
  return out;
}

/**
 * По дням: для каждого дня — последние цены предприятий за этот и два предыдущих дня
 * (так же, как предложения живут в сводке), плюс сегодняшняя точка в реальном времени.
 */
export function dailySeries(history: DailyClose[], quotes: Quote[], scope: Scope, days: number, now: number, minCount = 1): SeriesPoint[] {
  const byCompany = new Map<string, DailyClose[]>();
  for (const h of history) {
    if (!inScope(h.regionId, scope)) continue;
    let arr = byCompany.get(h.companyId);
    if (!arr) byCompany.set(h.companyId, (arr = []));
    arr.push(h);
  }
  const allDays = [...new Set(history.map((h) => h.day))].sort().slice(-(days - 1));
  const out: SeriesPoint[] = [];
  for (const day of allDays) {
    const from = shiftDay(day, -2);
    const pts: DailyClose[] = [];
    for (const closes of byCompany.values()) {
      let best: DailyClose | undefined;
      for (const c of closes) if (c.day >= from && c.day <= day && (!best || c.day > best.day)) best = c;
      if (best) pts.push(best);
    }
    if (pts.length < minCount) continue;
    const p = point(new Date(day + "T12:00:00").getTime(), pts);
    if (p) out.push(p);
  }
  const today = activeOffers(quotes.filter((q) => inScope(q.regionId, scope)), now);
  if (today.length >= minCount) {
    const p = point(now, today);
    if (p) out.push(p);
  }
  return out;
}

/** Опорная цена для проверки нового ответа: медиана региона (от 3 предприятий), иначе рынка */
export function referenceInfo(offers: Quote[], regionId: RegionId, excludeCompany?: string): { price: number; scope: "region" | "market" } | undefined {
  const all = offers.filter((q) => q.companyId !== excludeCompany);
  const region = all.filter((q) => q.regionId === regionId);
  const useRegion = region.length >= 3;
  const stats = computeIndex(useRegion ? region : all);
  return stats ? { price: stats.index, scope: useRegion ? "region" : "market" } : undefined;
}

export function referencePrice(offers: Quote[], regionId: RegionId, excludeCompany?: string): number | undefined {
  return referenceInfo(offers, regionId, excludeCompany)?.price;
}
