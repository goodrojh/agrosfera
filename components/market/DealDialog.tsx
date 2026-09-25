"use client";

import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";

const field =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40";

/**
 * Сделка по цене из стакана. Запрос приходит нам:
 * buy — экспортёр/агент хочет купить по цене предприятия, sell — предприятие хочет продать по цене покупателя.
 */
export default function DealDialog({
  side,
  price,
  volume: initialVolume,
  cropName,
  available,
  initialRegion,
  onClose,
}: {
  side: "buy" | "sell";
  price: number;
  volume?: number;
  cropName: string;
  available: RegionId[];
  initialRegion?: RegionId;
  onClose: () => void;
}) {
  const { submitDeal, mode } = useMarket();
  const [role, setRole] = useState<"exporter" | "agent">("exporter");
  const [region, setRegion] = useState<RegionId>(initialRegion ?? available[0]);
  const [volume, setVolume] = useState(initialVolume ? String(initialVolume) : "");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const buy = side === "buy";

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
    const err = await submitDeal({
      side,
      price,
      volume: Number(volume),
      role: buy ? role : "producer",
      region: buy ? undefined : region,
      name,
      contact,
    });
    if (err) {
      setError(err);
      setState("form");
      return;
    }
    setState("done");
  };

  const accent = buy ? "bg-[#c0492f] hover:bg-[#a83e27]" : "bg-[#2f7a1f] hover:bg-[#276719]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={buy ? "Купить по цене предприятия" : "Продать по цене покупателя"}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {state === "done" ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#1F5A25] text-white flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900">Запрос принят</p>
            <p className="mt-1 text-sm text-gray-500">
              {buy ? "Проверим предприятие и партию" : "Проверим покупателя"} и свяжемся с вами, чтобы провести сделку через АгроСферу.
            </p>
            {mode === "demo" && <p className="mt-3 text-xs text-gray-400">Демо-режим: запрос никуда не отправлен.</p>}
            <button onClick={onClose} className="mt-6 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{buy ? "Экспортёру или агенту" : "Предприятию"}</p>
                <p className="text-lg font-semibold text-gray-900">{buy ? "Купить по цене предприятия" : "Продать по цене покупателя"}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Закрыть" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className={"mt-4 rounded-xl px-4 py-3 " + (buy ? "bg-[#fdf1ee]" : "bg-[#f1f7ec]")}>
              <p className="text-xs text-gray-500">{cropName} · ₽/т с НДС, самовывоз</p>
              <p className={"text-2xl font-bold tabular-nums " + (buy ? "text-[#c0492f]" : "text-[#2f7a1f]")}>{rub(price)} ₽/т</p>
            </div>

            {buy ? (
              <div className="mt-4 flex bg-gray-100 p-1 rounded-xl" role="group" aria-label="Кто вы">
                {(["exporter", "agent"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={
                      "flex-1 py-2 text-sm rounded-lg transition-colors " +
                      (role === r ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")
                    }
                  >
                    {r === "exporter" ? "Я экспортёр" : "Я агент"}
                  </button>
                ))}
              </div>
            ) : (
              <label className="mt-4 block text-sm text-gray-600">
                Где предприятие
                <select value={region} onChange={(e) => setRegion(e.target.value as RegionId)} className={field + " mt-1"}>
                  {available.map((id) => (
                    <option key={id} value={id}>
                      {REGION_BY_ID[id].name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="mt-3 block text-sm text-gray-600">
              {buy ? "Сколько нужно, т" : "Сколько готовы продать, т"}
              <input
                value={volume}
                onChange={(e) => setVolume(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="500"
                className={field + " mt-1 tabular-nums"}
              />
            </label>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={buy ? "Имя или компания" : "Название предприятия"} className={field} />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон или @telegram" className={field} />
            </div>

            {error && <p className="mt-3 text-sm text-[#c0492f]">{error}</p>}

            <button type="submit" disabled={state === "sending"} className={"mt-5 w-full rounded-xl text-white py-3 font-semibold disabled:opacity-60 transition-colors " + accent}>
              {state === "sending" ? "Отправляем…" : buy ? "Хочу купить по этой цене" : "Хочу продать по этой цене"}
            </button>
            <p className="mt-3 text-xs text-gray-400 text-center">
              Запрос придёт менеджеру АгроСферы. Мы {buy ? "проверим предприятие и партию" : "проверим покупателя"}, сведём стороны и проведём сделку через себя.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
