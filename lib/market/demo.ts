// Демо-рынок: детерминированная история за 90 дней и поток подач «как из бота».
// Работает, пока к сайту не подключён сервер (NEXT_PUBLIC_API_URL).

import { REGIONS, REGION_BY_ID, type RegionId } from "./regions";
import { dayKey, latestAccepted, referencePrice } from "./aggregate";
import { checkQuote } from "./validate";
import type { Company, DailyClose, MarketSnapshot, Quote } from "./types";

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
}

const HISTORY_DAYS = 90;
const DAY = 86_400_000;
const round50 = (n: number) => Math.round(n / 50) * 50;
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

/** Общерыночный фактор: рост к августу, давление нового урожая в сентябре */
function marketFactor(dayOffset: number): number {
  const x = (dayOffset + HISTORY_DAYS - 1) / (HISTORY_DAYS - 1);
  return 0.95 + 0.09 * Math.sin(x * Math.PI * 0.85);
}

export interface DemoMarket {
  snapshot: MarketSnapshot;
  next(now: number, current: Quote[]): Quote;
  submit(companyId: string, regionId: RegionId, price: number, volume: number, now: number, current: Quote[], moderation?: boolean): Quote;
}

export function createDemoMarket(now: number): DemoMarket {
  const rng = mulberry32(20260925);
  const companies: DemoCompany[] = [];
  let seq = 400;
  for (const r of REGIONS) {
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      seq += 1 + Math.floor(rng() * 9);
      companies.push({
        id: `c${seq}`,
        code: `П-${String(seq).padStart(4, "0")}`,
        regionId: r.id,
        offset: (rng() - 0.5) * 0.06,
        capacity: 80 + rng() * 1400,
        reliability: 0.72 + rng() * 0.25,
      });
    }
  }

  // Региональные случайные блуждания с возвратом к среднему
  const walk: Record<string, number[]> = {};
  for (const r of REGIONS) {
    const arr: number[] = [];
    let v = 0;
    for (let d = 0; d < HISTORY_DAYS; d++) {
      v = v * 0.9 + (rng() - 0.5) * 0.008;
      arr.push(1 + v);
    }
    walk[r.id] = arr;
  }
  const factor = (regionId: RegionId, d: number) =>
    REGION_BY_ID[regionId].basePrice * marketFactor(d) * walk[regionId][d + HISTORY_DAYS - 1];

  const history: DailyClose[] = [];
  for (let d = -(HISTORY_DAYS - 1); d < 0; d++) {
    const key = dayKey(now + d * DAY);
    const weekday = new Date(now + d * DAY).getDay();
    for (const c of companies) {
      const p = weekday === 0 ? c.reliability * 0.4 : c.reliability;
      if (rng() > p) continue;
      history.push({
        day: key,
        companyId: c.id,
        regionId: c.regionId,
        price: round50(factor(c.regionId, d) * (1 + c.offset) * (1 + (rng() - 0.5) * 0.012)),
        volume: round10(c.capacity * (0.35 + rng() * 0.65)),
      });
    }
  }

  // Сегодня: подачи с 07:00 (или за последние 2 часа, если открыли рано утром)
  let qid = 0;
  const makeId = () => `q${Date.now().toString(36)}${(qid++).toString(36)}`;
  const d0 = new Date(now);
  const seven = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 7, 0, 0).getTime();
  const start = now - seven > 2 * 3600_000 ? seven : now - 2 * 3600_000;
  const span = Math.max(60_000, now - start - 60_000);

  const today: Quote[] = [];
  const todayCompanies = companies.filter(() => rng() < 0.78);
  for (const c of todayCompanies) {
    const at = start + rng() * span;
    const price = round50(factor(c.regionId, 0) * (1 + c.offset) * (1 + (rng() - 0.5) * 0.012));
    const volume = round10(c.capacity * (0.35 + rng() * 0.65));
    today.push({ id: makeId(), companyId: c.id, regionId: c.regionId, price, volume, at, status: "accepted", revision: 1 });
    if (rng() < 0.22) {
      const at2 = at + rng() * (now - at);
      const p2 = round50(price * (1 + (rng() - 0.55) * 0.02));
      today.push({
        id: makeId(), companyId: c.id, regionId: c.regionId, price: p2,
        volume: round10(volume * (0.7 + rng() * 0.4)), at: at2, status: "accepted", revision: 2, prevPrice: price,
      });
    }
  }
  // Пара ошибок ввода, которые система не пустила в расчёт
  for (let i = 0; i < 3 && todayCompanies.length > 5; i++) {
    const c = todayCompanies[Math.floor(rng() * todayCompanies.length)];
    const real = round50(factor(c.regionId, 0) * (1 + c.offset));
    const typo = i === 1 ? real * 10 : Math.round(real / 1000);
    today.push({
      id: makeId(), companyId: c.id, regionId: c.regionId, price: typo, volume: round10(c.capacity * 0.5),
      at: start + rng() * span, status: "rejected", revision: 0,
      note: i === 1 ? `Лишний ноль → запрошено подтверждение ${real.toLocaleString("ru-RU")} ₽/т` : `Цена в тысячах → запрошено подтверждение ${(typo * 1000).toLocaleString("ru-RU")} ₽/т`,
    });
  }
  today.sort((a, b) => a.at - b.at);

  const pendingFix: { companyId: string; price: number; volume: number; due: number }[] = [];
  const byId = new Map(companies.map((c) => [c.id, c]));

  function build(c: Company, price: number, volume: number, at: number, current: Quote[]): Quote {
    const latest = latestAccepted(current);
    const prev = latest.get(c.id);
    const check = checkQuote(price, volume, {
      reference: referencePrice(latest, c.regionId, c.id),
      previous: prev?.price,
    });
    const revision = current.filter((q) => q.companyId === c.id && q.status === "accepted").length + 1;
    if (check.level === "reject" || check.suggestion) {
      return {
        id: makeId(), companyId: c.id, regionId: c.regionId, price, volume, at, status: "rejected", revision: 0,
        note: check.issues[0]?.message,
      };
    }
    return {
      id: makeId(), companyId: c.id, regionId: c.regionId, price, volume, at,
      status: check.moderation ? "moderation" : "accepted",
      revision, prevPrice: prev?.price,
      note: check.moderation ? "Отклонение от медианы — ручная проверка" : undefined,
    };
  }

  function next(at: number, current: Quote[]): Quote {
    const fixIdx = pendingFix.findIndex((f) => f.due <= at);
    if (fixIdx >= 0) {
      const f = pendingFix.splice(fixIdx, 1)[0];
      return build(byId.get(f.companyId)!, f.price, f.volume, at, current);
    }
    const latest = latestAccepted(current);
    const submitted = companies.filter((c) => latest.has(c.id));
    const silent = companies.filter((c) => !latest.has(c.id));
    const r = Math.random();
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    if (r < 0.08 && submitted.length) {
      const c = pick(submitted);
      const real = latest.get(c.id)!.price;
      const typo = Math.round(real / 1000);
      pendingFix.push({ companyId: c.id, price: round50(real * (1 + (Math.random() - 0.5) * 0.01)), volume: latest.get(c.id)!.volume, due: at + 4000 });
      return build(c, typo, latest.get(c.id)!.volume, at, current);
    }
    if ((r < 0.32 && silent.length) || submitted.length === 0) {
      const c = pick(silent.length ? silent : companies);
      const price = round50(factor(c.regionId, 0) * (1 + c.offset) * (1 + (Math.random() - 0.5) * 0.012));
      return build(c, price, round10(c.capacity * (0.35 + Math.random() * 0.65)), at, current);
    }
    const c = pick(submitted);
    const prev = latest.get(c.id)!;
    const drift = (Math.random() - 0.52) * 0.018;
    const volume = Math.random() < 0.5 ? round10(prev.volume * (0.75 + Math.random() * 0.2)) : round10(prev.volume * (0.9 + Math.random() * 0.3));
    return build(c, round50(prev.price * (1 + drift)), volume, at, current);
  }

  function submit(companyId: string, regionId: RegionId, price: number, volume: number, at: number, current: Quote[], moderation = false): Quote {
    const prev = latestAccepted(current).get(companyId);
    const revision = current.filter((q) => q.companyId === companyId && q.status === "accepted").length + 1;
    return {
      id: makeId(), companyId, regionId, price, volume, at, revision, prevPrice: prev?.price,
      status: moderation ? "moderation" : "accepted",
      note: moderation ? "Отклонение от медианы — ручная проверка" : undefined,
    };
  }

  return {
    snapshot: {
      companies: companies.map(({ id, code, regionId }) => ({ id, code, regionId })),
      today,
      history,
      serverTime: now,
    },
    next,
    submit,
  };
}
