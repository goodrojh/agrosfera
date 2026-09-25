"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/config";
import { api } from "@/lib/account";
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
  comment?: string;
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

  /** Загрузить снимок рынка культуры с сервера */
  const loadLive = useCallback(async (c: CropId) => {
    try {
      const res = await fetch(`${API_URL}/api/snapshot?crop=${c}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const snap = await res.json();
      const st: CropStore = {
        demo: null,
        companies: snap.companies,
        history: snap.history,
        today: snap.today,
        bids: snap.bids ?? [],
        lastEventAt: Math.max(0, ...snap.today.map((q: Quote) => q.at)),
      };
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

  // Боевой режим: снимок выбранной культуры + поток событий с сервера бота по всем культурам
  useEffect(() => {
    if (mode !== "live") return;
    let closed = false;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    // Событие относится к культуре из поля crop (у старых записей — лён); загруженные культуры обновляем
    const cropOf = (x: { crop?: CropId }) => x.crop ?? "flax";

    loadLive(cropRef.current).then(() => {
      if (closed) return;
      es = new EventSource(`${API_URL}/api/stream`);
      es.addEventListener("open", () => setConnected(true));
      es.addEventListener("error", () => setConnected(false));
      es.addEventListener("quote", (e) => {
        const q: Quote = JSON.parse((e as MessageEvent).data);
        pushTo(cropOf(q), q);
      });
      es.addEventListener("bid", (e) => {
        const b: Bid = JSON.parse((e as MessageEvent).data);
        pushBid(cropOf(b), b);
      });
      // Новый участник или изменения — перечитываем выбранную культуру
      es.addEventListener("company", () => void loadLive(cropRef.current));
      es.addEventListener("reset", () => {
        for (const c of [...stores.current.keys()]) if (c !== cropRef.current) stores.current.delete(c);
        void loadLive(cropRef.current);
      });
      poll = setInterval(() => void loadLive(cropRef.current), 60_000);
    });

    return () => {
      closed = true;
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [mode, pushTo, pushBid, loadLive]);

  const submitBid = useCallback(
    async (input: BidInput): Promise<string | null> => {
      const c = cropRef.current;
      const st = stores.current.get(c);
      if (!st) return "Данные ещё загружаются";
      const reference = computeIndex([...latestAccepted(st.today).values()])?.index;
      const err = checkBid(input.price, input.volume, reference);
      if (err) return err;
      if (mode === "demo") {
        if (input.name.trim().length < 2 || input.contact.trim().length < 5) return "Укажите имя или компанию и телефон / Telegram — чтобы мы могли связаться.";
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
      // Заявка от имени компании из кабинета: ждёт проверки менеджером и появится в стакане после подтверждения
      try {
        await api("/api/cabinet/bids", { crop: c, price: input.price, volume: input.volume, regions: input.regions });
        return null;
      } catch (e) {
        return (e as Error).message;
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
      if (mode === "demo") {
        if (input.name.trim().length < 2 || input.contact.trim().length < 5) return "Укажите имя или компанию и телефон / Telegram.";
        await new Promise((r) => setTimeout(r, 400));
        return null;
      }
      try {
        await api("/api/cabinet/deal", { side: input.side, crop: cropRef.current, price: input.price, volume: input.volume, comment: input.comment ?? "" });
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [mode]
  );

  const companyById = useMemo(() => new Map(active.companies.map((c) => [c.id, c])), [active.companies]);
  const latest = useMemo(() => latestAccepted(active.today), [active.today]);
  // Сервер собирает цены по всем культурам: если участников ещё нет — окно покажет пустой стакан
  const supported = true;

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
