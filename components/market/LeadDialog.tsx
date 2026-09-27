"use client";

import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { CROPS, CROP_BY_ID, type CropId } from "@/lib/market/crops";
import { REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";
import type { Quote } from "@/lib/market/types";

const field =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40";

const pct = (n?: number) => (n === undefined ? "—" : `${String(n).replace(".", ",")}%`);
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/**
 * Заявка нашему менеджеру без регистрации.
 * offer — заявка на конкретное предложение из сводки; без него — общий запрос «подберите объём».
 */
export default function LeadDialog({ offer, crop: initialCrop, regions: initialRegions = [], onClose }: { offer?: Quote; crop: CropId; regions?: RegionId[]; onClose: () => void }) {
  const { submitLead, mode } = useMarket();
  const [crop, setCrop] = useState<CropId>(offer?.crop ?? initialCrop);
  const [volume, setVolume] = useState(offer ? String(offer.volume) : "");
  const [price, setPrice] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const cropInfo = CROP_BY_ID[crop];

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
    const err = await submitLead({
      offerId: offer?.id,
      crop,
      regions: offer ? undefined : initialRegions,
      volume: Number(volume) || undefined,
      price: offer ? undefined : Number(price) || undefined,
      name,
      company,
      phone,
      comment,
    });
    if (err) {
      setError(err);
      setState("form");
      return;
    }
    setState("done");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Заявка">
      <div className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {state === "done" ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#1F5A25] text-white flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900">Заявка отправлена</p>
            <p className="mt-1 text-sm text-gray-500">Наш менеджер свяжется с вами в ближайшее время.</p>
            {mode === "demo" && <p className="mt-3 text-xs text-gray-400">Демо-режим: заявка никуда не отправлена.</p>}
            <button onClick={onClose} className="mt-6 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-900">{offer ? "Заявка на предложение" : "Подобрать объём"}</p>
                <p className="text-sm text-gray-500">{offer ? "Менеджер проверит партию и проведёт сделку" : "Опишите, что нужно, — подберём у партнёров"}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Закрыть" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {offer ? (
              <div className="mt-4 rounded-xl bg-[#f3f8ee] px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-gray-600">
                    {cropInfo.name} · {REGION_BY_ID[offer.regionId].name}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-[#1F5A25] whitespace-nowrap">{rub(offer.price)} ₽/т</p>
                </div>
                <p className="mt-1 text-xs text-gray-500 tabular-nums">
                  {rub(offer.volume)} т · влажность {pct(offer.moisture)} · сорная примесь {pct(offer.impurity)}
                  {cropInfo.quality ? ` · ${cropInfo.quality.label.toLowerCase()} ${pct(offer.quality)}` : ""}
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="col-span-2 text-sm text-gray-600">
                  Культура
                  <select value={crop} onChange={(e) => setCrop(e.target.value as CropId)} className={field + " mt-1"}>
                    {CROPS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-gray-600">
                  Цена до, ₽/т <span className="text-gray-400">— если есть</span>
                  <input value={price} onChange={(e) => setPrice(digits(e.target.value))} inputMode="numeric" className={field + " mt-1 tabular-nums"} />
                </label>
                <label className="text-sm text-gray-600">
                  Объём, т
                  <input value={volume} onChange={(e) => setVolume(digits(e.target.value))} inputMode="numeric" className={field + " mt-1 tabular-nums"} />
                </label>
                {initialRegions.length > 0 && <p className="col-span-2 text-xs text-gray-500">Регионы: {initialRegions.map((r) => REGION_BY_ID[r].name).join(", ")}</p>}
              </div>
            )}

            {offer && (
              <label className="mt-3 block text-sm text-gray-600">
                Сколько нужно, т
                <input value={volume} onChange={(e) => setVolume(digits(e.target.value))} inputMode="numeric" className={field + " mt-1 tabular-nums"} />
              </label>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" autoComplete="name" className={field} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" inputMode="tel" autoComplete="tel" className={field} />
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Компания" autoComplete="organization" className={field + " col-span-2"} />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder={offer ? "Комментарий: базис, сроки, оплата" : "Требования к качеству, базис, сроки"}
                className={field + " col-span-2 resize-none"}
              />
            </div>

            {error && <p className="mt-3 text-sm text-[#c0492f]">{error}</p>}

            <button type="submit" disabled={state === "sending"} className="mt-5 w-full rounded-xl bg-[#1F5A25] text-white py-3 font-semibold hover:bg-[#174a1c] disabled:opacity-60 transition-colors">
              {state === "sending" ? "Отправляем…" : "Отправить заявку"}
            </button>
            <p className="mt-3 text-xs text-gray-400 text-center">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
          </form>
        )}
      </div>
    </div>
  );
}
