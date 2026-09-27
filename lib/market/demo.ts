// Демо-рынок: детерминированная история за 90 дней и поток ответов «как из бота».
// Работает, пока к сайту не подключён сервер (NEXT_PUBLIC_API_URL).

import { REGIONS, REGION_BY_ID, type RegionId } from "./regions";
import { IMPURITY, MOISTURE, type QualitySpec } from "./crops";
import { activeOffers, dayKey, referencePrice } from "./aggregate";
import { checkQuote } from "./validate";
import type { Company, DailyClose, MarketSnapshot, QualityValues, Quote } from "./types";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoCompany extends Company {
  offset: number;
  capacity: number;
  reliability: number;
  moisture: number;
  impurity: number;
  quality: number;
}

const HISTORY_DAYS = 90;
const DAY = 86_400_000;
const round50 = (n: number) => Math.round(n / 50) * 50;
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Общерыночный фактор: рост к августу, давление нового урожая в сентябре */
function marketFactor(dayOffset: number): number {
  const x = (dayOffset + HISTORY_DAYS - 1) / (HISTORY_DAYS - 1);
  return 0.95 + 0.09 * Math.sin(x * Math.PI * 0.85);
}

export interface DemoMarket {
  snapshot: MarketSnapshot;
  /** Следующий ответ какого-нибудь предприятия */
  next(now: number, current: Quote[]): Quote;
  /** Ответ из симулятора бота на сайте */
  submit(companyId: string, regionId: RegionId, offer: { price: number; volume: number } & QualityValues, now: number, moderation?: boolean): Quote;
}

export interface DemoOptions {
  seed?: number;
  /** Регионы, где выращивают культуру */
  regions?: RegionId[];
  /** Средняя цена культуры по России; региональные различия берутся из справочника регионов */
  basePrice?: number;
  quality?: QualitySpec | null;
}

const FLAX_AVG = 31700;

export function createDemoMarket(now: number, opts: DemoOptions = {}): DemoMarket {
  const rng = mulberry32(opts.seed ?? 20260925);
  const spec = opts.quality ?? null;
  const regionList = opts.regions ? REGIONS.filter((r) => opts.regions!.includes(r.id)) : REGIONS;
  const regionPrice = (id: RegionId) =>
    opts.basePrice ? opts.basePrice * (1 + (REGION_BY_ID[id].basePrice / FLAX_AVG - 1) * 0.8) : REGION_BY_ID[id].basePrice;

  const companies: DemoCompany[] = [];
  let seq = 400;
  for (const r of regionList) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      seq += 1 + Math.floor(rng() * 9);
      companies.push({
        id: `c${seq}`,
        code: `П-${String(seq).padStart(4, "0")}`,
        regionId: r.id,
        offset: (rng() - 0.5) * 0.06,
        capacity: 80 + rng() * 1400,
        reliability: 0.72 + rng() * 0.25,
        moisture: 6 + rng() * 5,
        impurity: 0.5 + rng() * 2.5,
        quality: spec ? spec.typical + (rng() - 0.5) * (spec.typical * 0.12) : 0,
      });
    }
  }

  // Региональные случайные блуждания с возвратом к среднему
  const walk: Record<string, number[]> = {};
  for (const r of regionList) {
    const arr: number[] = [];
    let v = 0;
    for (let d = 0; d < HISTORY_DAYS; d++) {
      v = v * 0.9 + (rng() - 0.5) * 0.008;
      arr.push(1 + v);
    }
    walk[r.id] = arr;
  }
  const factor = (regionId: RegionId, d: number) => regionPrice(regionId) * marketFactor(d) * walk[regionId][d + HISTORY_DAYS - 1];
  const priceOf = (c: DemoCompany, d: number, r: () => number) => round50(factor(c.regionId, d) * (1 + c.offset) * (1 + (r() - 0.5) * 0.012));
  const volumeOf = (c: DemoCompany, r: () => number) => round10(c.capacity * (0.35 + r() * 0.65));
  const qualityOf = (c: DemoCompany, r: () => number): QualityValues => ({
    moisture: round1(clamp(c.moisture + (r() - 0.5) * 0.6, MOISTURE.min, MOISTURE.max)),
    impurity: round1(clamp(c.impurity + (r() - 0.5) * 0.4, IMPURITY.min, IMPURITY.max)),
    ...(spec ? { quality: round1(clamp(c.quality + (r() - 0.5) * 0.4, spec.min, spec.max)) } : {}),
  });

  let qid = 0;
  const makeId = () => `q${Date.now().toString(36)}${(qid++).toString(36)}`;
  /** Утро дня d: ответы приходят с 8 до 11 */
  const morning = (d: number, r: () => number) => {
    const base = new Date(now + d * DAY);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 8, 0, 0).getTime() + r() * 3 * 3600_000;
  };

  // История: дневные закрытия, и те же цены за последние дни — ответами с качеством
  const history: DailyClose[] = [];
  const recent: Quote[] = [];
  for (let d = -(HISTORY_DAYS - 1); d < 0; d++) {
    const key = dayKey(now + d * DAY);
    for (const c of companies) {
      if (rng() > c.reliability * 0.85) continue;
      const price = priceOf(c, d, rng);
      const volume = volumeOf(c, rng);
      history.push({ day: key, companyId: c.id, regionId: c.regionId, price, volume });
      if (d >= -3) {
        recent.push({ id: makeId(), companyId: c.id, regionId: c.regionId, price, volume, at: morning(d, rng), status: "accepted", revision: 1, ...qualityOf(c, rng) });
      }
    }
  }

  // Сегодня: ответы с 8:00 (или за последние 2 часа, если открыли рано)
  const eight = morning(0, () => 0);
  const start = now - eight > 2 * 3600_000 ? eight : now - 2 * 3600_000;
  const span = Math.max(60_000, now - start - 60_000);
  for (const c of companies) {
    if (rng() > 0.7) continue;
    const at = start + rng() * span;
    if (rng() < 0.05) {
      recent.push({ id: makeId(), companyId: c.id, regionId: c.regionId, price: 0, volume: 0, at, status: "withdrawn", revision: 1 });
      continue;
    }
    recent.push({ id: makeId(), companyId: c.id, regionId: c.regionId, price: priceOf(c, 0, rng), volume: volumeOf(c, rng), at, status: "accepted", revision: 1, ...qualityOf(c, rng) });
  }
  recent.sort((a, b) => a.at - b.at);

  function build(c: DemoCompany, price: number, volume: number, at: number, current: Quote[]): Quote {
    const offers = activeOffers(current, at);
    const prev = offers.find((q) => q.companyId === c.id);
    const check = checkQuote(price, volume, { reference: referencePrice(offers, c.regionId, c.id), previous: prev?.price });
    return {
      id: makeId(), companyId: c.id, regionId: c.regionId, price, volume, at,
      status: check.level === "reject" ? "rejected" : check.moderation ? "moderation" : "accepted",
      revision: (prev?.revision ?? 0) + 1, prevPrice: prev?.price, ...qualityOf(c, Math.random),
    };
  }

  function next(at: number, current: Quote[]): Quote {
    const offers = new Map(activeOffers(current, at).map((q) => [q.companyId, q]));
    const c = companies[Math.floor(Math.random() * companies.length)];
    const prev = offers.get(c.id);
    if (prev && Math.random() < 0.04) {
      return { id: makeId(), companyId: c.id, regionId: c.regionId, price: 0, volume: 0, at, status: "withdrawn", revision: prev.revision + 1 };
    }
    const price = prev ? round50(prev.price * (1 + (Math.random() - 0.52) * 0.018)) : priceOf(c, 0, Math.random);
    const volume = prev ? round10(prev.volume * (0.8 + Math.random() * 0.35)) : volumeOf(c, Math.random);
    return build(c, price, volume, at, current);
  }

  function submit(companyId: string, regionId: RegionId, offer: { price: number; volume: number } & QualityValues, at: number, moderation = false): Quote {
    return {
      id: makeId(), companyId, regionId, at, revision: 1, ...offer,
      status: moderation ? "moderation" : "accepted",
      note: moderation ? "Отклонение от медианы — ручная проверка" : undefined,
    };
  }

  return {
    snapshot: {
      companies: companies.map(({ id, code, regionId }) => ({ id, code, regionId })),
      recent,
      history,
      serverTime: now,
    },
    next,
    submit,
  };
}
