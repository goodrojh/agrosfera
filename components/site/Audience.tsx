"use client";

import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { asset } from "@/lib/config";
import { openRequest } from "./SiteHeader";

// ── Общие блоки страниц «Экспортёрам» и «Предприятиям» ──

type Tone = "white" | "gray";
const bg = (tone: Tone) => (tone === "gray" ? "bg-[#f4f6f2]" : "bg-white");
const card = (tone: Tone) => "rounded-2xl border border-gray-200 p-6 " + (tone === "gray" ? "bg-white" : "bg-[#fafbf8]");

function Steps({ title, steps, tone = "white" }: { title: string; steps: [string, string][]; tone?: Tone }) {
  return (
    <section className={bg(tone) + " px-4 md:px-8 py-16 md:py-20"}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900">{title}</h2>
        <ol className={"mt-8 grid gap-4 sm:grid-cols-2 " + (steps.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
          {steps.map(([t, d], i) => (
            <li key={t} className={card(tone)}>
              <span className="text-sm font-semibold text-[#1F5A25] tabular-nums">0{i + 1}</span>
              <p className="mt-3 text-lg font-semibold text-gray-900 leading-snug">{t}</p>
              <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Cards({ title, items, tone = "white" }: { title: string; items: [string, string][]; tone?: Tone }) {
  return (
    <section className={bg(tone) + " px-4 md:px-8 py-16 md:py-20"}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900">{title}</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map(([t, d]) => (
            <div key={t} className={card(tone)}>
              <Check size={20} className="text-[#1F5A25]" />
              <p className="mt-3 text-lg font-semibold text-gray-900 leading-snug">{t}</p>
              <p className="mt-2 text-[15px] text-gray-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Экспортёрам ──

const SUMMARY_FIELDS = [
  "Регион склада",
  "Свободный объём, т",
  "Влажность, %",
  "Сорная примесь, %",
  "Масличность или протеин, %",
  "Цена, ₽/т с НДС, со склада",
  "Когда обновлено",
];

export function ExportersContent() {
  return (
    <>
      <section className="bg-white px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900 leading-tight">Что вы видите в сводке</h2>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              Каждое утро проверенные предприятия присылают нам предложения, и мы сразу их публикуем. Вы видите реальные объёмы и качество партии ещё до звонка, а мы выкупаем партию и доставляем груз в нужную вам точку.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={asset("/#terminal")} className="inline-flex items-center gap-2 rounded-lg bg-[#1F5A25] text-white px-5 py-3 text-[15px] font-semibold hover:bg-[#174a1c]">
                Открыть сводку <ArrowRight size={16} />
              </a>
              <button onClick={openRequest} className="rounded-lg border border-gray-200 px-5 py-3 text-[15px] font-semibold text-gray-800 hover:bg-gray-50">
                Оставить запрос
              </button>
            </div>
          </div>
          <ul className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {SUMMARY_FIELDS.map((f) => (
              <li key={f} className="flex items-center gap-3 px-5 py-3.5 text-[15px] text-gray-800">
                <Check size={17} className="text-[#1F5A25] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Steps
        tone="gray"
        title="Как проходит сделка"
        steps={[
          ["Выбираете объём", "Оставляете заявку у предложения в сводке или общий запрос: культура, регион, объём, требования к качеству."],
          ["Проверяем партию", "Менеджер связывается с предприятием, подтверждает объём, качество и документы на партию."],
          ["Заключаем договор", "Фиксируем цену, объём, пункт доставки и сроки в договоре с нами — одна сторона вместо десятка хозяйств."],
          ["Выкупаем и доставляем", "Выкупаем партию и доставляем груз в нужную вам точку — порт, погранпереход, станцию или ваш склад."],
        ]}
      />

      <Cards
        title="Почему с нами"
        items={[
          ["Только проверенные предприятия", "Документы и склад каждого партнёра проверяем до того, как он попадёт в сводку."],
          ["Качество до заявки", "Влажность, сорная примесь, масличность или протеин — в каждом предложении."],
          ["Свежие данные", "Предложения обновляются каждое утро, старше 3 дней в сводке не бывает."],
          ["Доставка до вашей точки", "Везём груз туда, куда нужно вам: порт, погранпереход, станция или ваш склад."],
        ]}
      />

      <section className="bg-[#07160a] text-white px-4 md:px-8 py-14">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-[26px] md:text-[32px] font-semibold tracking-tight">Нужен объём под контракт?</h2>
            <p className="mt-2 text-white/65">Оставьте запрос — подберём у партнёров и вернёмся с предложением.</p>
          </div>
          <button onClick={openRequest} className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-white text-[#0b1f0e] px-6 py-3.5 text-[15px] font-semibold hover:bg-white/90">
            Оставить запрос <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </>
  );
}

// ── Предприятиям ──

const FROM_YOU: [string, string][] = [
  ["Каждое утро — одна строка", "Цена, объём, влажность, сорная примесь, масличность (у зерновых — протеин). Например: 31500 200 8 1.5 46."],
  ["Изменилось днём — новая строка", "Цена или объём поменялись — отправьте боту новую строку, сводка обновится сразу."],
  ["Нечего продать — одна кнопка", "«Сегодня нет в продаже» снимает предложение со сводки."],
  ["Быть на связи по заявке", "Когда появится покупатель, менеджер позвонит, чтобы согласовать отгрузку."],
];

export function ProducersContent({ bot }: { bot?: React.ReactNode }) {
  return (
    <>
      <Steps
        title="Как стать партнёром"
        steps={[
          ["Анкета", "Заполняете короткую форму внизу страницы — пара минут."],
          ["Верификация", "Менеджер звонит, проверяет данные предприятия, склад и документы на продукцию. Это делается один раз."],
          ["Подключение", "Подключаем бота в Telegram и закрепляем за вами культуры, которые вы продаёте."],
          ["Одно сообщение в день", "Каждое утро в 8:00 по вашему времени бот просит предложение. Вы отвечаете одной строкой — и всё."],
          ["Покупатель и сделка", "Предложение появляется в сводке без названия предприятия. Когда экспортёр оставляет заявку, мы согласуем условия, выкупаем партию и вывозим её с вашего склада."],
        ]}
      />

      {bot}

      <section className="bg-[#f4f6f2] px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-gray-900 leading-tight">Что нужно от вас после проверки</h2>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">Документы, звонки и поиск покупателей — на нас. От вас — только актуальная информация о партии.</p>
          </div>
          <ul className="space-y-3">
            {FROM_YOU.map(([t, d]) => (
              <li key={t} className="rounded-2xl bg-white border border-gray-200 p-5">
                <p className="font-semibold text-gray-900">{t}</p>
                <p className="mt-1 text-[15px] text-gray-600 leading-relaxed">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Cards
        title="Что вы получаете"
        items={[
          ["Покупателей без поиска", "Экспортёры видят ваш объём каждый день и приходят с заявками к нам."],
          ["Анонимность", "В сводке — только регион, объём, качество и цена. Название предприятия видим только мы."],
          ["Бесплатно", "Подключение и публикация предложений ничего не стоят."],
          ["Без обязательств", "Вы сами решаете, что и когда продавать."],
        ]}
      />
    </>
  );
}
