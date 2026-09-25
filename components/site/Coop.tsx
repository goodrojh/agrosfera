"use client";

import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { asset } from "@/lib/config";
import { CABINET_URL } from "@/lib/account";

// ── Роли ──

const ROLES = [
  {
    role: "producer",
    title: "Предприятиям",
    lead: "Продавайте урожай покупателям из стакана.",
    points: ["Цена и объём — в кабинете или одним сообщением в Telegram-бот", "Название предприятия в стакане скрыто", "Продажа по заявке покупателя в одно нажатие", "Подключение и подача цен бесплатны"],
    cta: "Зарегистрировать предприятие",
  },
  {
    role: "exporter",
    title: "Экспортёрам",
    lead: "Покупайте напрямую у предприятий по всей России.",
    points: ["Цены и свободные объёмы по регионам — каждый день", "Своя заявка в стакане: предприятия видят спрос", "Проверяем продавца, выкупаем и отгружаем партию", "Условия фиксируем в договоре"],
    cta: "Зарегистрироваться",
  },
  {
    role: "agent",
    title: "Агентам",
    lead: "Закрывайте заказы своих покупателей.",
    points: ["Актуальные цены и объёмы без обзвона", "Заявки и покупка — в личном кабинете", "Сделку сопровождает АгроСфера", "Условия и процент — в договоре"],
    cta: "Зарегистрироваться",
  },
] as const;

export function Roles() {
  return (
    <section id="roli" className="bg-white px-4 md:px-8 py-16 md:py-20 scroll-mt-4">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4 md:gap-5">
        {ROLES.map((r) => (
          <div key={r.role} className="rounded-2xl border border-gray-200 p-6 md:p-7 flex flex-col">
            <h2 className="text-[22px] font-semibold text-gray-900">{r.title}</h2>
            <p className="mt-2 text-gray-600">{r.lead}</p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {r.points.map((p) => (
                <li key={p} className="flex gap-2.5 text-[15px] text-gray-700">
                  <Check size={17} className="text-[#1F5A25] shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
            <a
              href={`${CABINET_URL}?role=${r.role}`}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F5A25] text-white px-5 py-3 text-[15px] font-semibold hover:bg-[#174a1c] transition-colors"
            >
              {r.cta} <ArrowRight size={16} />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Как начать ──

const STEPS = [
  ["Регистрация", "Роль, компания, регион и телефон — пара минут."],
  ["Проверка", "Менеджер звонит и проверяет компанию."],
  ["Работа", "Цены, заявки и стакан — в личном кабинете."],
  ["Сделка", "Цены сошлись — менеджер сводит стороны и проводит сделку."],
];

export function Steps() {
  return (
    <section className="bg-[#f4f6f2] px-4 md:px-8 py-16 md:py-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900">Как начать</h2>
        <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-white border border-gray-200 p-6">
              <span className="text-sm font-semibold text-[#1F5A25] tabular-nums">0{i + 1}</span>
              <p className="mt-3 text-lg font-semibold text-gray-900">{t}</p>
              <p className="mt-1.5 text-[15px] text-gray-600 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Личный кабинет: скриншоты ──

const SHOTS = [
  {
    id: "terminal",
    title: "Терминал",
    text: "График и стакан с кнопками вашей роли: предприятие продаёт по заявке покупателя, экспортёр и агент покупают по цене предприятия.",
    image: "/coop/terminal.webp",
  },
  {
    id: "prices",
    title: "Цены предприятия",
    text: "Цена и свободный объём по каждой культуре. Каждое утро бот в Telegram напомнит обновить их.",
    image: "/coop/prices.webp",
  },
  {
    id: "bids",
    title: "Заявки покупателя",
    text: "Заявки на покупку и их статус: на проверке, в стакане, снята.",
    image: "/coop/bids.webp",
  },
  {
    id: "matches",
    title: "Совпадения",
    text: "Цены покупателя и предприятия сошлись — менеджер связывается с обеими сторонами, а сделка появляется в кабинете.",
    image: "/coop/matches.webp",
  },
];

export function CabinetShowcase() {
  const [i, setI] = useState(0);
  const shot = SHOTS[i];
  return (
    <section id="kabinet" className="bg-white px-4 md:px-8 py-16 md:py-24 scroll-mt-4">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900">Личный кабинет</h2>
          <p className="mt-3 text-lg text-gray-600">Всё для работы с рынком — в одном окне.</p>
        </div>

        <div className="mt-10 grid lg:grid-cols-[300px_1fr] gap-6 lg:gap-10 items-start">
          <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0" role="tablist">
            {SHOTS.map((s, n) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={n === i}
                onClick={() => setI(n)}
                className={
                  "shrink-0 lg:shrink text-left rounded-xl border px-4 py-3.5 transition-colors min-w-[220px] lg:min-w-0 " +
                  (n === i ? "border-[#1F5A25] bg-[#f3f8ee]" : "border-gray-200 hover:border-gray-300")
                }
              >
                <p className={"font-semibold " + (n === i ? "text-[#1F5A25]" : "text-gray-900")}>{s.title}</p>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed hidden lg:block">{s.text}</p>
              </button>
            ))}
          </div>

          <div>
            <div className="rounded-2xl border border-gray-200 bg-[#eef1ea] p-2 md:p-3 shadow-[0_24px_60px_-20px_rgba(16,40,20,0.25)]">
              <div className="flex items-center gap-1.5 px-2 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              </div>
              <img key={shot.image} src={asset(shot.image)} alt={shot.title} className="w-full rounded-lg border border-gray-200 bg-white" />
            </div>
            <p className="mt-4 text-[15px] text-gray-600 lg:hidden">{shot.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
