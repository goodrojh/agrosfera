"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/config";
import { createDemoMarket, type DemoMarket } from "@/lib/market/demo";
import { computeIndex, latestAccepted } from "@/lib/market/aggregate";
import { checkBid } from "@/lib/market/validate";
import { CROPS, CROP_BY_ID, type CropId } from "@/lib/market/crops";
import type { RegionId } from "@/lib/market/regions";
import type { Bid, BuyerType, Company, DailyClose, Quote } from "@/lib/market/types";

export const SIM_COMPANY_ID = "c-you";

interface MarketValue {
  ready: boolean;
  mode: "demo" | "live";
  connected: boolean;
  crop: CropId;
  setCrop: (c: CropId) => void;
  /** Есть ли данные по выбранной культуре (на сервере пока только лён) */
  supported: boolean;
  companies: Company[];
  companyById: Map<string, Company>;
  today: Quote[];
  history: DailyClose[];
  latest: Map<string, Quote>;
  lastEventAt: number;
  /** Активные заявки покупателей по выбранной культуре */
  bids: Bid[];
  /** Разместить заявку на покупку. Возвращает текст ошибки или null */
  submitBid: (input: BidInput) => Promise<string | null>;
  /** Запрос на сделку по цене из стакана — приходит нам, сводим стороны сами */
  submitDeal: (input: DealInput) => Promise<string | null>;
  /** Подача из симулятора бота — всегда по льну */
  submitFromSimulator: (regionId: RegionId, price: number, volume: number, moderation?: boolean) => Quote | null;
}

export interface BidInput {
  price: number;
  volume: number;
  regions: RegionId[];
  buyer: BuyerType;
  name: string;
  contact: string;
}

export interface DealInput {
  /** buy — экспортёр/агент хочет купить по цене предприятия; sell — предприятие хочет продать по цене покупателя */
  side: "buy" | "sell";
  price: number;
  volume: number;
  role: "exporter" | "agent" | "producer";
  region?: RegionId;
  name: string;
  contact: string;
}

interface CropStore {
  demo: DemoMarket | null;
  companies: Company[];
  history: DailyClose[];
  today: Quote[];
  bids: Bid[];
  lastEventAt: number;
}

const MarketContext = createContext<MarketValue | null>(null);

export function useMarket(): MarketValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider");
  return ctx;
}

const EMPTY: CropStore = { demo: null, companies: [], history: [], today: [], bids: [], lastEventAt: 0 };

function makeDemoStore(crop: CropId, now: number): CropStore {
  const c = CROP_BY_ID[crop];
  const demo = createDemoMarket(now, {
    seed: 20260925 + CROPS.findIndex((x) => x.id === crop) * 7919,
    regions: c.regions,
    basePrice: crop === "flax" ? undefined : c.basePrice,
  });
  return {
    demo,
    companies: demo.snapshot.companies,
    history: demo.snapshot.history,
    today: demo.snapshot.today,
    bids: demo.snapshot.bids,
    lastEventAt: Math.max(...demo.snapshot.today.map((q) => q.at), now - 30_000),
  };
}

export default function MarketProvider({ children }: { children: React.ReactNode }) {
  const mode: "demo" | "live" = API_URL ? "live" : "demo";
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [crop, setCropState] = useState<CropId>("flax");
  const [active, setActive] = useState<CropStore>(EMPTY);
  const stores = useRef(new Map<CropId, CropStore>());
  const cropRef = useRef<CropId>("flax");

  /** Добавить подачу в рынок культуры; экран обновляется, только если культура выбрана */
  const pushTo = useCallback((c: CropId, q: Quote) => {
    const st = stores.current.get(c);
    if (!st) return;
    const next = { ...st, today: [...st.today.filter((x) => x.id !== q.id), q], lastEventAt: q.at };
    stores.current.set(c, next);
    if (cropRef.current === c) setActive(next);
  }, []);

  /** Добавить или обновить заявку покупателя */
  const pushBid = useCallback((c: CropId, b: Bid) => {
    const st = stores.current.get(c);
    if (!st) return;
    let bids = [...st.bids.filter((x) => x.id !== b.id), b].filter((x) => x.status === "active");
    // В демо держим стакан спроса компактным: старые чужие заявки уходят
    const others = bids.filter((x) => !x.own);
    if (st.demo && others.length > 14) {
      const oldest = others.reduce((a, x) => (x.at < a.at ? x : a));
      bids = bids.filter((x) => x.id !== oldest.id);
    }
    const next = { ...st, bids, lastEventAt: Math.max(st.lastEventAt, b.at) };
    stores.current.set(c, next);
    if (cropRef.current === c) setActive(next);
  }, []);

  const setCrop = useCallback(
    (c: CropId) => {
      cropRef.current = c;
      setCropState(c);
      if (!stores.current.has(c)) {
        stores.current.set(c, mode === "demo" ? makeDemoStore(c, Date.now()) : EMPTY);
      }
      setActive(stores.current.get(c)!);
    },
    [mode]
  );

  // Демо-режим: данные создаются только в браузере (зависят от текущего времени)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "demo") return;
    const st = makeDemoStore("flax", Date.now());
    stores.current.set("flax", st);
    setActive(st);
    setReady(true);
    setConnected(true);

    // Новые подачи приходят только по выбранной культуре и только когда вкладка видна
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        const c = cropRef.current;
        const s = stores.current.get(c);
        if (!document.hidden && s?.demo) {
          if (Math.random() < 0.2) pushBid(c, s.demo.nextBid(Date.now(), s.today));
          else pushTo(c, s.demo.next(Date.now(), s.today));
        }
        loop();
      }, 3500 + Math.random() * 3500);
    };
    loop();
    return () => clearTimeout(timer);
  }, [mode, pushTo, pushBid]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Боевой режим: снимок + поток событий с сервера бота (пока только лён)
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
        const st: CropStore = {
          demo: null,
          companies: snap.companies,
          history: snap.history,
          today: snap.today,
          bids: snap.bids ?? [],
          lastEventAt: Math.max(0, ...snap.today.map((q: Quote) => q.at)),
        };
        stores.current.set("flax", st);
        if (cropRef.current === "flax") setActive(st);
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
      es.addEventListener("quote", (e) => pushTo("flax", JSON.parse((e as MessageEvent).data)));
      es.addEventListener("bid", (e) => pushBid("flax", JSON.parse((e as MessageEvent).data)));
      es.addEventListener("company", (e) => {
        const c: Company = JSON.parse((e as MessageEvent).data);
        const st = stores.current.get("flax");
        if (!st) return;
        const next = { ...st, companies: [...st.companies.filter((x) => x.id !== c.id), c] };
        stores.current.set("flax", next);
        if (cropRef.current === "flax") setActive(next);
      });
      es.addEventListener("reset", () => load());
      poll = setInterval(load, 60_000);
    });

    return () => {
      closed = true;
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [mode, pushTo, pushBid]);

  const submitBid = useCallback(
    async (input: BidInput): Promise<string | null> => {
      const c = cropRef.current;
      const st = stores.current.get(c);
      if (!st) return "Данные ещё загружаются";
      const reference = computeIndex([...latestAccepted(st.today).values()])?.index;
      const err = checkBid(input.price, input.volume, reference);
      if (err) return err;
      if (input.name.trim().length < 2 || input.contact.trim().length < 5) return "Укажите имя или компанию и телефон / Telegram — чтобы мы могли связаться.";

      if (mode === "demo") {
        pushBid(c, {
          id: `own${Date.now().toString(36)}`,
          price: input.price,
          volume: input.volume,
          regions: input.regions,
          buyer: input.buyer,
          at: Date.now(),
          status: "active",
          own: true,
        });
        return null;
      }
      try {
        const res = await fetch(`${API_URL}/api/bids`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crop: c, ...input }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return data.error ?? "Не удалось отправить заявку";
        pushBid(c, { ...data.bid, own: true });
        return null;
      } catch {
        return "Нет связи с сервером. Попробуйте ещё раз.";
      }
    },
    [mode, pushBid]
  );

  const submitFromSimulator = useCallback(
    (regionId: RegionId, price: number, volume: number, moderation = false): Quote | null => {
      const st = stores.current.get("flax");
      if (mode !== "demo" || !st?.demo) return null;
      const companies = st.companies.some((c) => c.id === SIM_COMPANY_ID)
        ? st.companies.map((c) => (c.id === SIM_COMPANY_ID ? { ...c, regionId } : c))
        : [...st.companies, { id: SIM_COMPANY_ID, code: "П-0001 · вы", regionId }];
      stores.current.set("flax", { ...st, companies });
      const q = st.demo.submit(SIM_COMPANY_ID, regionId, price, volume, Date.now(), st.today, moderation);
      pushTo("flax", q);
      return q;
    },
    [mode, pushTo]
  );

  const submitDeal = useCallback(
    async (input: DealInput): Promise<string | null> => {
      if (!input.volume || input.volume < 1) return "Укажите объём.";
      if (input.name.trim().length < 2 || input.contact.trim().length < 5) return "Укажите имя или компанию и телефон / Telegram.";
      const cropName = CROP_BY_ID[cropRef.current].name;
      const what = input.side === "buy" ? "Хочет купить по цене предприятия" : "Хочет продать по цене покупателя";
      if (mode === "demo") {
        await new Promise((r) => setTimeout(r, 400));
        return null;
      }
      try {
        const res = await fetch(`${API_URL}/api/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: input.role,
            name: input.name,
            contact: input.contact,
            target: input.region ?? "",
            volume: input.volume,
            comment: `${what}: ${input.price.toLocaleString("ru-RU")} ₽/т · ${cropName}`,
          }),
        });
        if (!res.ok) return (await res.json().catch(() => ({}))).error ?? "Не удалось отправить";
        return null;
      } catch {
        return "Нет связи с сервером. Попробуйте ещё раз.";
      }
    },
    [mode]
  );

  const companyById = useMemo(() => new Map(active.companies.map((c) => [c.id, c])), [active.companies]);
  const latest = useMemo(() => latestAccepted(active.today), [active.today]);
  const supported = mode === "demo" || crop === "flax";

  const value = useMemo<MarketValue>(
    () => ({
      ready,
      mode,
      connected,
      crop,
      setCrop,
      supported,
      companies: active.companies,
      companyById,
      today: active.today,
      history: active.history,
      latest,
      lastEventAt: active.lastEventAt,
      bids: active.bids,
      submitBid,
      submitDeal,
      submitFromSimulator,
    }),
    [ready, mode, connected, crop, setCrop, supported, active, companyById, latest, submitBid, submitDeal, submitFromSimulator]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
