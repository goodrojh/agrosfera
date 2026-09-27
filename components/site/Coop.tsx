"use client";

import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { API_URL, asset } from "@/lib/config";
import { CROPS, type CropId } from "@/lib/market/crops";
import { REGIONS, type RegionId } from "@/lib/market/regions";
import { openRequest } from "./SiteHeader";

// ── Две стороны: покупатели и предприятия ──

const SIDES = [
  {
    id: "buyers",
    title: "Экспортёрам и агентам",
    lead: "Проверенные объёмы с известным качеством — без обзвона предприятий.",
    steps: [
      "Смотрите сводку: регион, объём, влажность, сорная примесь, масличность или протеин, цена.",
      "Нажимаете «Оставить заявку» у нужного предложения или оставляете общий запрос.",
      "Менеджер проверяет партию и предприятие, согласует условия.",
      "Выкупаем и отгружаем партию. Условия — в договоре с АгроСферой.",
    ],
    cta: { label: "Смотреть сводку", href: "/#terminal" },
  },
  {
    id: "producers",
    title: "Предприятиям",
    lead: "Покупатели на ваш объём — одним сообщением в день.",
    steps: [
      "Заполняете анкету. Менеджер звонит и заранее проверяет документы.",
      "Каждый день в 8:00 по вашему времени бот в Telegram просит предложение.",
      "Отвечаете одной строкой: цена, объём, влажность, сорная примесь, масличность.",
      "Предложение появляется в сводке без названия предприятия, покупателя приводим мы.",
    ],
    cta: { label: "Стать партнёром", href: "#partner" },
  },
] as const;

export function Sides() {
  return (
    <section className="bg-white px-4 md:px-8 py-16 md:py-20">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-5">
        {SIDES.map((s) => (
          <div key={s.id} id={s.id} className="rounded-2xl border border-gray-200 p-6 md:p-8 flex flex-col scroll-mt-6">
            <h2 className="text-[24px] font-semibold text-gray-900">{s.title}</h2>
            <p className="mt-2 text-gray-600">{s.lead}</p>
            <ol className="mt-6 space-y-3.5 flex-1">
              {s.steps.map((t, i) => (
                <li key={t} className="flex gap-3 text-[15px] text-gray-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full border border-[#1F5A25]/25 text-[#1F5A25] text-xs font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={s.cta.href.startsWith("#") ? s.cta.href : asset(s.cta.href)} className="inline-flex items-center gap-2 rounded-lg bg-[#1F5A25] text-white px-5 py-3 text-[15px] font-semibold hover:bg-[#174a1c] transition-colors">
                {s.cta.label} <ArrowRight size={16} />
              </a>
              {s.id === "buyers" && (
                <button onClick={openRequest} className="rounded-lg border border-gray-200 px-5 py-3 text-[15px] font-semibold text-gray-800 hover:bg-gray-50">
                  Оставить запрос
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Почему через брокера ──

const WHY = [
  ["Только проверенные предприятия", "Документы и склад проверяем до того, как предприятие попадёт в сводку."],
  ["Качество известно заранее", "Влажность, сорная примесь и масличность или протеин — в каждом предложении."],
  ["Свежие данные", "Предприятия обновляют предложения каждое утро, старше 3 дней в сводке не бывает."],
  ["Одна точка контакта", "Проверка, договор, выкуп и отгрузка — через АгроСферу."],
];

export function Why() {
  return (
    <section className="bg-[#f4f6f2] px-4 md:px-8 py-16 md:py-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900">Почему через АгроСферу</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WHY.map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-white border border-gray-200 p-6">
              <p className="text-lg font-semibold text-gray-900 leading-snug">{t}</p>
              <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Анкета предприятия ──

const field =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40";
const REGION_OPTIONS = [...REGIONS].sort((a, b) => a.name.localeCompare(b.name, "ru"));

export function PartnerForm() {
  const [f, setF] = useState({ name: "", inn: "", regionId: "" as RegionId | "", person: "", phone: "", comment: "" });
  const [crops, setCrops] = useState<CropId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.name.trim().length < 2) return setError("Укажите название предприятия.");
    if (!f.regionId) return setError("Выберите регион.");
    if (f.phone.replace(/\D/g, "").length < 10) return setError("Укажите телефон — по нему бот узнает вас после проверки.");
    if (!crops.length) return setError("Отметьте культуры, которые продаёте.");
    setState("sending");
    if (!API_URL) {
      await new Promise((r) => setTimeout(r, 500));
      return setState("done");
    }
    try {
      const res = await fetch(`${API_URL}/api/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, crops }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не удалось отправить анкету");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("form");
    }
  };

  return (
    <section id="partner" className="bg-[#07160a] text-white px-4 md:px-8 py-16 md:py-20 scroll-mt-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-16">
        <div>
          <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight leading-tight">Стать партнёром</h2>
          <p className="mt-4 text-white/65 text-[17px] leading-relaxed max-w-md">
            Анкета для предприятий-производителей. Менеджер позвонит, проверит документы и подключит бота — после этого ваши предложения появятся в сводке.
          </p>
          <ul className="mt-6 space-y-2.5 text-white/70 text-[15px]">
            {["Бесплатно для предприятий", "Название предприятия в сводке скрыто", "Никаких обязательств продавать"].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check size={18} className="text-[#8CC152] shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {state === "done" ? (
          <div className="rounded-2xl border border-[#8CC152]/30 bg-[#8CC152]/10 p-8">
            <p className="text-xl font-semibold">✓ Анкета отправлена</p>
            <p className="mt-2 text-white/70 leading-relaxed">
              {API_URL
                ? "Менеджер свяжется с вами в рабочее время, проверит документы и подключит бота. Бот узнает вас по номеру телефона из анкеты."
                : "Сейчас сайт работает в демо-режиме: анкета не отправлена. После подключения сервера анкеты будут приходить менеджеру."}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl bg-white text-gray-900 p-5 md:p-7">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-600 sm:col-span-2">
                Название предприятия
                <input value={f.name} onChange={set("name")} className={field + " mt-1"} placeholder="ООО «Нива»" />
              </label>
              <label className="text-sm text-gray-600">
                ИНН <span className="text-gray-400">— если есть</span>
                <input value={f.inn} onChange={(e) => setF((x) => ({ ...x, inn: e.target.value.replace(/\D/g, "").slice(0, 12) }))} inputMode="numeric" className={field + " mt-1 tabular-nums"} />
              </label>
              <label className="text-sm text-gray-600">
                Регион склада
                <select value={f.regionId} onChange={set("regionId")} className={field + " mt-1"}>
                  <option value="">Выберите…</option>
                  {REGION_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-600">
                Контактное лицо
                <input value={f.person} onChange={set("person")} className={field + " mt-1"} placeholder="Иван Петров" />
              </label>
              <label className="text-sm text-gray-600">
                Телефон
                <input value={f.phone} onChange={set("phone")} inputMode="tel" className={field + " mt-1"} placeholder="+7 900 000-00-00" />
              </label>
            </div>
            <p className="mt-4 text-sm text-gray-600">Что продаёте</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CROPS.map((c) => {
                const on = crops.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCrops((xs) => (on ? xs.filter((x) => x !== c.id) : [...xs, c.id]))}
                    className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " + (on ? "border-[#1F5A25] bg-[#1F5A25] text-white" : "border-gray-200 text-gray-700 hover:border-gray-300")}
                  >
                    {on && <Check size={14} />} {c.name}
                  </button>
                );
              })}
            </div>
            <textarea value={f.comment} onChange={set("comment")} rows={2} placeholder="Объёмы, склад, удобное время для звонка (необязательно)" className={field + " mt-4 resize-none"} />
            {error && <p className="mt-3 text-sm text-[#c0492f]">{error}</p>}
            <button type="submit" disabled={state === "sending"} className="mt-5 w-full rounded-xl bg-[#1F5A25] text-white py-3 font-semibold hover:bg-[#174a1c] disabled:opacity-60">
              {state === "sending" ? "Отправляем…" : "Отправить анкету"}
            </button>
            <p className="mt-3 text-xs text-gray-400 text-center">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
          </form>
        )}
      </div>
    </section>
  );
}
