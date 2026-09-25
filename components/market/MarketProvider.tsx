"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/config";
import { createDemoMarket, type DemoMarket } from "@/lib/market/demo";
import { latestAccepted } from "@/lib/market/aggregate";
import type { RegionId } from "@/lib/market/regions";
import type { Company, DailyClose, Quote } from "@/lib/market/types";

export const SIM_COMPANY_ID = "c-you";

interface MarketValue {
  ready: boolean;
  mode: "demo" | "live";
  connected: boolean;
  companies: Company[];
  companyById: Map<string, Company>;
  today: Quote[];
  history: DailyClose[];
  latest: Map<string, Quote>;
  lastEventAt: number;
  /** Подача из симулятора бота (в демо-режиме попадает в график) */
  submitFromSimulator: (regionId: RegionId, price: number, volume: number, moderation?: boolean) => Quote | null;
}

const MarketContext = createContext<MarketValue | null>(null);

export function useMarket(): MarketValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider");
  return ctx;
}

export default function MarketProvider({ children }: { children: React.ReactNode }) {
  const mode: "demo" | "live" = API_URL ? "live" : "demo";
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [today, setToday] = useState<Quote[]>([]);
  const [history, setHistory] = useState<DailyClose[]>([]);
  const [lastEventAt, setLastEventAt] = useState(0);
  const demoRef = useRef<DemoMarket | null>(null);
  const todayRef = useRef<Quote[]>([]);

  const push = useCallback((q: Quote) => {
    todayRef.current = [...todayRef.current.filter((x) => x.id !== q.id), q];
    setToday(todayRef.current);
    setLastEventAt(q.at);
  }, []);

  // Демо-режим: локальный генератор подач.
  // Данные создаются только на клиенте после монтирования (зависят от текущего времени),
  // иначе статическая сборка и браузер отрисуют разное.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "demo") return;
    const now = Date.now();
    const demo = createDemoMarket(now);
    demoRef.current = demo;
    setCompanies(demo.snapshot.companies);
    setHistory(demo.snapshot.history);
    todayRef.current = demo.snapshot.today;
    setToday(demo.snapshot.today);
    setLastEventAt(Math.max(...demo.snapshot.today.map((q) => q.at), now - 30_000));
    setReady(true);
    setConnected(true);

    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        if (!document.hidden) push(demo.next(Date.now(), todayRef.current));
        loop();
      }, 2500 + Math.random() * 3500);
    };
    loop();
    return () => clearTimeout(timer);
  }, [mode, push]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Боевой режим: снимок + поток событий с сервера бота
  useEffect(() => {
    if (mode !== "live") return;
    let closed = false;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const snap = await res.json();
        if (closed) return;
        setCompanies(snap.companies);
        setHistory(snap.history);
        todayRef.current = snap.today;
        setToday(snap.today);
        setLastEventAt(Math.max(0, ...snap.today.map((q: Quote) => q.at)));
        setReady(true);
      } catch {
        setConnected(false);
      }
    };

    load().then(() => {
      if (closed) return;
      es = new EventSource(`${API_URL}/api/stream`);
      es.addEventListener("open", () => setConnected(true));
      es.addEventListener("error", () => setConnected(false));
      es.addEventListener("quote", (e) => push(JSON.parse((e as MessageEvent).data)));
      es.addEventListener("company", (e) => {
        const c: Company = JSON.parse((e as MessageEvent).data);
        setCompanies((prev) => [...prev.filter((x) => x.id !== c.id), c]);
      });
      es.addEventListener("reset", () => load());
      // Страховка на случай, если прокси режет SSE
      poll = setInterval(load, 60_000);
    });

    return () => {
      closed = true;
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [mode, push]);

  const submitFromSimulator = useCallback(
    (regionId: RegionId, price: number, volume: number, moderation = false): Quote | null => {
      if (mode !== "demo" || !demoRef.current) return null;
      setCompanies((prev) =>
        prev.some((c) => c.id === SIM_COMPANY_ID)
          ? prev.map((c) => (c.id === SIM_COMPANY_ID ? { ...c, regionId } : c))
          : [...prev, { id: SIM_COMPANY_ID, code: "П-0001 · вы", regionId }]
      );
      const q = demoRef.current.submit(SIM_COMPANY_ID, regionId, price, volume, Date.now(), todayRef.current, moderation);
      push(q);
      return q;
    },
    [mode, push]
  );

  const value = useMemo<MarketValue>(() => {
    return {
      ready,
      mode,
      connected,
      companies,
      companyById: new Map(companies.map((c) => [c.id, c])),
      today,
      history,
      latest: latestAccepted(today),
      lastEventAt,
      submitFromSimulator,
    };
  }, [ready, mode, connected, companies, today, history, lastEventAt, submitFromSimulator]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
