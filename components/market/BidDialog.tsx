"use client";

import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import RegionPicker from "@/components/market/RegionPicker";
import type { IndexStats } from "@/lib/market/aggregate";
import type { RegionId } from "@/lib/market/regions";
import type { BuyerType } from "@/lib/market/types";

const field =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40";

/** Заявка на покупку: появляется в стакане сразу после отправки */
export default function BidDialog({
  cropName,
  initialPrice,
  initialVolume,
  initialRegions,
  available,
  stats,
  bestAsk,
  onClose,
}: {
  cropName: string;
  /** Лучшая цена продавца — чтобы подсказать про совпадение */
  bestAsk?: number;
  initialPrice?: number;
  initialVolume?: number;
  initialRegions: RegionId[];
  available: RegionId[];
  stats: Map<RegionId, IndexStats>;
  onClose: () => void;
}) {
  const { submitBid, mode } = useMarket();
  const [price, setPrice] = useState(initialPrice ? String(initialPrice) : "");
  const [volume, setVolume] = useState(initialVolume ? String(initialVolume) : "");
  const [regions, setRegions] = useState<RegionId[]>(initialRegions);
  const [buyer, setBuyer] = useState<BuyerType>("exporter");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "sending" | "done">("form");

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const err = await submitBid({ price: Number(price), volume: Number(volume), regions, buyer, name, contact });
    if (err) {
      setError(err);
      setState("form");
      return;
    }
    setState("done");
    setTimeout(onClose, mode === "live" ? 3500 : 1400);
  };

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Заявка на покупку">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {state === "done" ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2f7a1f] text-white flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900">{mode === "live" ? "Заявка на проверке" : "Заявка в стакане"}</p>
            <p className="mt-1 text-sm text-gray-500">
              {mode === "live" ? "Менеджер проверит её и поставит в стакан — обычно в течение часа в рабочее время. " : ""}
              {bestAsk && Number(price) >= bestAsk
                ? "Ваша цена совпала с ценой продавца — менеджер свяжется с вами для сделки."
                : "Производители её видят. Мы свяжемся с вами, как найдём объём."}
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-900">Заявка на покупку</p>
                <p className="text-sm text-gray-500">{cropName} · ₽/т с НДС, самовывоз</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Закрыть" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex bg-gray-100 p-1 rounded-xl" role="group" aria-label="Кто вы">
              {(["exporter", "agent"] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setBuyer(r)}
                  className={
                    "flex-1 py-2 text-sm rounded-lg transition-colors " +
                    (buyer === r ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")
                  }
                >
                  {r === "exporter" ? "Я экспортёр" : "Я агент"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="text-sm text-gray-600">
                Цена, ₽/т
                <input value={price} onChange={(e) => setPrice(digits(e.target.value))} inputMode="numeric" placeholder="30 000" className={field + " mt-1 tabular-nums"} autoFocus />
              </label>
              <label className="text-sm text-gray-600">
                Объём, т
                <input value={volume} onChange={(e) => setVolume(digits(e.target.value))} inputMode="numeric" placeholder="500" className={field + " mt-1 tabular-nums"} />
              </label>
            </div>

            <div className="mt-3 text-sm text-gray-600">
              Из каких регионов <span className="text-gray-400">— необязательно</span>
              <div className="mt-1 [&>div]:w-full">
                <RegionPicker value={regions} onChange={setRegions} stats={stats} available={available} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя или компания" className={field} />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон или @telegram" className={field} />
            </div>

            {error && <p className="mt-3 text-sm text-[#c0492f]">{error}</p>}

            <button
              type="submit"
              disabled={state === "sending"}
              className="mt-5 w-full rounded-xl bg-[#2f7a1f] text-white py-3 font-semibold hover:bg-[#276719] disabled:opacity-60 transition-colors"
            >
              {state === "sending" ? "Отправляем…" : "Поставить заявку в стакан"}
            </button>
            <p className="mt-3 text-xs text-gray-400 text-center">
              Заявки проверяет менеджер. В стакане видны только цена и объём, контакты — только нам.
              {mode === "demo" && " Сейчас демо-режим: заявка сохраняется только у вас в браузере."}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
