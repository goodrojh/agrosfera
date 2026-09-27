"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/config";
import { createDemoMarket, type DemoMarket } from "@/lib/market/demo";
import { activeOffers, computeIndex } from "@/lib/market/aggregate";
import { CROPS, CROP_BY_ID, type CropId } from "@/lib/market/crops";
import type { RegionId } from "@/lib/market/regions";
import type { Company, DailyClose, QualityValues, Quote } from "@/lib/market/types";

export const SIM_COMPANY_ID = "c-you";

/** Сколько доступно сегодня по России по культуре */
export interface CropSummary {
  crop: CropId;
  volume: number;
  count: number;
  index: number | null;
}


interface MarketValue {
  ready: boolean;
  mode: "demo" | "live";
  connected: boolean;
  crop: CropId;
  setCrop: (c: CropId) => void;
  companies: Company[];
  companyById: Map<string, Company>;
  /** Ответы предприятий за последние дни */
  recent: Quote[];
  history: DailyClose[];
  /** Действующие предложения — то, что видно в сводке */
  offers: Quote[];
  /** «Сейчас» для расчётов: обновляется раз в минуту и с каждым новым ответом */
  now: number;
  /** Объёмы по всем культурам — для первого экрана */
  summary: CropSummary[];
  lastEventAt: number;
  /** Ответ из симулятора бота на сайте — всегда по льну */
  submitFromSimulator: (regionId: RegionId, offer: { price: number; volume: number } & QualityValues, moderation?: boolean) => Quote | null;
}

interface CropStore {
  demo: DemoMarket | null;
  companies: Company[];
  history: DailyClose[];
  recent: Quote[];
  lastEventAt: number;
}

const MarketContext = createContext<MarketValue | null>(null);

export function useMarket(): MarketValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider");
  return ctx;
}

const EMPTY: CropStore = { demo: null, companies: [], history: [], recent: [], lastEventAt: 0 };
const lastAt = (qs: Quote[]) => qs.reduce((m, q) => Math.max(m, q.at), 0);

/** Итоги по культурам из демо-рынков в памяти */
function demoSummary(stores: Map<CropId, CropStore>, now: number): CropSummary[] {
  return CROPS.map((c) => {
    const offers = activeOffers(stores.get(c.id)?.recent ?? [], now);
    return { crop: c.id, volume: offers.reduce((s, q) => s + q.volume, 0), count: offers.length, index: computeIndex(offers)?.index ?? null };
  });
}

function makeDemoStore(crop: CropId, now: number): CropStore {
  const c = CROP_BY_ID[crop];
  const demo = createDemoMarket(now, {
    seed: 20260925 + CROPS.findIndex((x) => x.id === crop) * 7919,
    regions: c.regions,
    basePrice: crop === "flax" ? undefined : c.basePrice,
    quality: c.quality,
  });
  return { demo, companies: demo.snapshot.companies, history: demo.snapshot.history, recent: demo.snapshot.recent, lastEventAt: lastAt(demo.snapshot.recent) };
}

export default function MarketProvider({ children }: { children: React.ReactNode }) {
  const mode: "demo" | "live" = API_URL ? "live" : "demo";
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [crop, setCropState] = useState<CropId>("flax");
  const [active, setActive] = useState<CropStore>(EMPTY);
  // Предложения стареют (3 дня) — пересчитываем раз в минуту, даже если новых ответов нет
  const [clock, setClock] = useState(0);
  const [summary, setSummary] = useState<CropSummary[]>([]);
  const stores = useRef(new Map<CropId, CropStore>());
  const cropRef = useRef<CropId>("flax");

  /** Добавить ответ в рынок культуры; экран обновляется, только если культура выбрана */
  const pushTo = useCallback((c: CropId, q: Quote) => {
    const st = stores.current.get(c);
    if (!st) return;
    const next = { ...st, recent: [...st.recent.filter((x) => x.id !== q.id), q], lastEventAt: Math.max(st.lastEventAt, q.at) };
    stores.current.set(c, next);
    if (cropRef.current === c) setActive(next);
  }, []);

  const loadLive = useCallback(async (c: CropId) => {
    try {
      const res = await fetch(`${API_URL}/api/snapshot?crop=${c}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const snap = await res.json();
      const st: CropStore = { demo: null, companies: snap.companies, history: snap.history, recent: snap.recent ?? [], lastEventAt: lastAt(snap.recent ?? []) };
      stores.current.set(c, st);
      if (cropRef.current === c) setActive(st);
      setReady(true);
    } catch {
      setConnected(false);
    }
  }, []);

  const setCrop = useCallback(
    (c: CropId) => {
      cropRef.current = c;
      setCropState(c);
      if (!stores.current.has(c)) {
        stores.current.set(c, mode === "demo" ? makeDemoStore(c, Date.now()) : EMPTY);
        if (mode === "live") void loadLive(c);
      }
      setActive(stores.current.get(c)!);
    },
    [mode, loadLive]
  );

  useEffect(() => {
    const tick = () => setClock(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // Демо-режим: данные создаются только в браузере (зависят от текущего времени)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "demo") return;
    const st = makeDemoStore("flax", Date.now());
    stores.current.set("flax", st);
    setActive(st);
    setReady(true);
    setConnected(true);
    // Остальные культуры — для сводки объёмов на первом экране
    for (const c of CROPS) if (!stores.current.has(c.id)) stores.current.set(c.id, makeDemoStore(c.id, Date.now()));
    setSummary(demoSummary(stores.current, Date.now()));

    // Новые ответы — только по выбранной культуре и только когда вкладка видна
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        const c = cropRef.current;
        const s = stores.current.get(c);
        if (!document.hidden && s?.demo) {
          pushTo(c, s.demo.next(Date.now(), s.recent));
          setSummary(demoSummary(stores.current, Date.now()));
        }
        loop();
      }, 5000 + Math.random() * 5000);
    };
    loop();
    return () => clearTimeout(timer);
  }, [mode, pushTo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Боевой режим: снимок выбранной культуры + поток ответов с сервера бота
  useEffect(() => {
    if (mode !== "live") return;
    let closed = false;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    let summaryTimer: ReturnType<typeof setTimeout> | null = null;
    const loadSummary = () =>
      fetch(`${API_URL}/api/summary`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => !closed && setSummary(d.crops ?? []))
        .catch(() => {});
    // Новые ответы идут пачками по утрам — пересчитываем итоги не чаще раза в 5 секунд
    const refreshSummary = () => {
      if (!summaryTimer) summaryTimer = setTimeout(() => ((summaryTimer = null), void loadSummary()), 5000);
    };
    void loadSummary();
    const summaryPoll = setInterval(() => void loadSummary(), 60_000);

    loadLive(cropRef.current).then(() => {
      if (closed) return;
      es = new EventSource(`${API_URL}/api/stream`);
      es.addEventListener("open", () => setConnected(true));
      es.addEventListener("error", () => setConnected(false));
      es.addEventListener("quote", (e) => {
        const q: Quote = JSON.parse((e as MessageEvent).data);
        pushTo(q.crop ?? "flax", q);
        refreshSummary();
      });
      es.addEventListener("company", () => void loadLive(cropRef.current));
      poll = setInterval(() => void loadLive(cropRef.current), 5 * 60_000);
    });

    return () => {
      closed = true;
      es?.close();
      if (poll) clearInterval(poll);
      clearInterval(summaryPoll);
      if (summaryTimer) clearTimeout(summaryTimer);
    };
  }, [mode, pushTo, loadLive]);

  const submitFromSimulator = useCallback(
    (regionId: RegionId, offer: { price: number; volume: number } & QualityValues, moderation = false): Quote | null => {
      const st = stores.current.get("flax");
      if (mode !== "demo" || !st?.demo) return null;
      if (!st.companies.some((c) => c.id === SIM_COMPANY_ID)) {
        stores.current.set("flax", { ...st, companies: [...st.companies, { id: SIM_COMPANY_ID, code: "П-0001 · вы", regionId }] });
      }
      const q = st.demo.submit(SIM_COMPANY_ID, regionId, offer, Date.now(), moderation);
      pushTo("flax", q);
      return q;
    },
    [mode, pushTo]
  );

  const companyById = useMemo(() => new Map(active.companies.map((c) => [c.id, c])), [active.companies]);
  const now = Math.max(clock, active.lastEventAt);
  const offers = useMemo(() => activeOffers(active.recent, now), [active.recent, now]);

  const value = useMemo<MarketValue>(
    () => ({
      ready,
      mode,
      connected,
      crop,
      setCrop,
      companies: active.companies,
      companyById,
      recent: active.recent,
      history: active.history,
      offers,
      now,
      summary,
      lastEventAt: active.lastEventAt,
      submitFromSimulator,
    }),
    [ready, mode, connected, crop, setCrop, active, companyById, offers, now, summary, submitFromSimulator]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
