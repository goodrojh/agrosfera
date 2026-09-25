"use client";

import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { CABINET_URL, useAccount } from "@/lib/account";
import { rub } from "@/lib/market/format";

const field =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40";

/**
 * Сделка по цене из стакана — запрос менеджеру АгроСферы.
 * sell — предприятие закрывает заявку покупателя целиком (объём не выбирается);
 * buy — покупатель берёт объём предприятия целиком или частично.
 */
export default function DealDialog({
  side,
  price,
  volume: levelVolume,
  cropName,
  onClose,
}: {
  side: "buy" | "sell";
  price: number;
  /** Объём строки стакана: заявка покупателя (sell) или свободный объём предприятия (buy) */
  volume: number;
  cropName: string;
  onClose: () => void;
}) {
  const { submitDeal, mode, crop } = useMarket();
  const { account } = useAccount();
  const [volume, setVolume] = useState(String(levelVolume));
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const buy = side === "buy";

  // Предприятию хватает объёма, только если сегодня заявлено не меньше, чем в заявке покупателя
  const own = account?.quotesToday.find((q) => q.crop === crop);
  const shortage = !buy && mode === "live" && (!own?.volume || own.volume < levelVolume);

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
    const v = buy ? Number(volume) : levelVolume;
    if (buy && (!v || v > levelVolume)) return setError(`Укажите объём до ${rub(levelVolume)} т — столько свободно у предприятия.`);
    setState("sending");
    const err = await submitDeal({ side, price, volume: v, role: account?.role ?? (buy ? "exporter" : "producer"), name: "", contact: "" });
    if (err) {
      setError(err);
      setState("form");
      return;
    }
    setState("done");
  };

  const accent = buy ? "bg-[#c0492f] hover:bg-[#a83e27]" : "bg-[#2f7a1f] hover:bg-[#276719]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={buy ? "Купить у предприятия" : "Продать покупателю"}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {state === "done" ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#1F5A25] text-white flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900">Запрос отправлен</p>
            <p className="mt-1 text-sm text-gray-500">Менеджер АгроСферы свяжется с вами и проведёт сделку.</p>
            {mode === "demo" && <p className="mt-3 text-xs text-gray-400">Демо-режим: запрос никуда не отправлен.</p>}
            <button onClick={onClose} className="mt-6 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-lg font-semibold text-gray-900">{buy ? "Купить у предприятия" : "Продать покупателю"}</p>
              <button type="button" onClick={onClose} aria-label="Закрыть" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className={"mt-4 rounded-xl px-4 py-3 " + (buy ? "bg-[#fdf1ee]" : "bg-[#f1f7ec]")}>
              <p className="text-xs text-gray-500">{cropName} · ₽/т с НДС, самовывоз</p>
              <p className={"text-2xl font-bold tabular-nums " + (buy ? "text-[#c0492f]" : "text-[#2f7a1f]")}>{rub(price)} ₽/т</p>
            </div>

            {buy ? (
              <label className="mt-4 block text-sm text-gray-600">
                Объём, т <span className="text-gray-400">— свободно {rub(levelVolume)} т</span>
                <input
                  value={volume}
                  onChange={(e) => setVolume(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  className={field + " mt-1 tabular-nums"}
                  autoFocus
                />
              </label>
            ) : (
              <div className="mt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Объём заявки</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{rub(levelVolume)} т</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">Заявка покупателя закрывается целиком.</p>
                {shortage && (
                  <p className="mt-3 rounded-lg bg-[#fff8e6] px-3 py-2 text-[13px] text-gray-700">
                    {own?.volume ? `Сегодня вы заявили ${rub(own.volume)} т — меньше объёма заявки.` : "Сегодня вы ещё не подали цену и объём по этой культуре."}{" "}
                    <a href={`${CABINET_URL}#prices`} className="font-medium text-[#1F5A25] underline underline-offset-2">
                      Обновить объём
                    </a>
                  </p>
                )}
              </div>
            )}

            {account && <p className="mt-3 text-xs text-gray-500">От компании: {account.name}</p>}
            {error && <p className="mt-3 text-sm text-[#c0492f]">{error}</p>}

            <button type="submit" disabled={state === "sending" || shortage} className={"mt-5 w-full rounded-xl text-white py-3 font-semibold disabled:opacity-50 transition-colors " + accent}>
              {state === "sending" ? "Отправляем…" : buy ? "Купить по этой цене" : `Продать ${rub(levelVolume)} т`}
            </button>
            <p className="mt-3 text-xs text-gray-400 text-center">Запрос придёт менеджеру: он проверит стороны и проведёт сделку через АгроСферу.</p>
          </form>
        )}
      </div>
    </div>
  );
}
