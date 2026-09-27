"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { asset } from "@/lib/config";
import { openPartner } from "@/lib/actions";

interface Step {
  title: string;
  text: string;
  image: string;
  /** Кнопка действия под текстом шага — открывает форму на месте */
  action?: { label: string; run: () => void };
}

const STEPS: Step[] = [
  {
    title: "Выберите культуру",
    text: "Слева — список культур. Нажмите на нужную: график и сводка покажут её предложения.",
    image: "/guide/1-crops.webp",
  },
  {
    title: "Выберите регионы",
    text: "По умолчанию — вся Россия. Начните вводить название в поле «Все регионы» и отметьте нужные — можно несколько.",
    image: "/guide/2-region.webp",
  },
  {
    title: "…или отметьте их на карте",
    text: "Нажмите «На карте» и кликайте по регионам. Чем темнее регион, тем дешевле. Затем «Применить».",
    image: "/guide/5-map.webp",
  },
  {
    title: "Следите за ценой",
    text: "График показывает среднюю цену предложений за день, неделю, месяц или 3 месяца. Выбрали несколько регионов — у каждого своя линия, их удобно сравнивать.",
    image: "/guide/3-chart.webp",
  },
  {
    title: "Смотрите предложения",
    text: "В сводке — предложения партнёров: регион, объём, влажность, сорная примесь, масличность или протеин, цена и время обновления. Сортируйте по цене, объёму или свежести.",
    image: "/guide/4-offers.webp",
  },
  {
    title: "Оставьте заявку",
    text: "Нажмите «Оставить заявку» у предложения: имя, телефон и нужный объём. Менеджер проверит партию и проведёт сделку. Регистрация не нужна.",
    image: "/guide/6-lead.webp",
  },
  {
    title: "Не нашли нужного — запрос",
    text: "Под сводкой — «Оставить запрос»: культура, объём, желаемая цена и требования к качеству. Подберём у партнёров.",
    image: "/guide/7-request.webp",
  },
  {
    title: "Предприятию: одно сообщение в день",
    text: "Каждый день в 8:00 по местному времени бот в Telegram просит предложение. Ответ одной строкой: цена, объём, влажность, сорная примесь, масличность — например, «31500 200 8 1.5 46».",
    image: "/guide/8-bot.webp",
    action: { label: "Стать партнёром", run: openPartner },
  },
];

/** Пошаговая инструкция к сводке со скриншотами */
export default function GuideDialog({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const go = useCallback((d: number) => setI((x) => Math.min(STEPS.length - 1, Math.max(0, x + d))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, go]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Инструкция">
      {/* Скриншот слева во всю высоту окна, текст и управление — справа. Окно заканчивается там, где заканчивается содержимое */}
      <div
        className="relative w-full max-w-[1280px] max-h-full overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col lg:flex-row lg:h-[min(84vh,720px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Закрыть" className="absolute right-3 top-3 z-10 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 bg-white/90 hover:bg-gray-100">
          <X size={18} />
        </button>

        {/* Скриншот */}
        <div className="flex-1 min-w-0 min-h-0 h-[44vh] lg:h-auto flex items-center justify-center p-3 md:p-5 bg-[#eef2ea]">
          {/* Скругление, тень и рамка — у самой картинки, поэтому углы чистые */}
          <img
            key={step.image}
            src={asset(step.image)}
            alt={step.title}
            className="block max-w-full max-h-full w-auto h-auto rounded-xl bg-white shadow-[0_8px_30px_-12px_rgba(16,40,20,0.35)] ring-1 ring-black/5 agr-fade"
          />
        </div>

        {/* Текст и управление */}
        <div className="lg:w-[320px] shrink-0 flex flex-col p-5 md:p-6 lg:border-l border-gray-100">
          <p className="text-sm text-gray-500 pr-10">
            Как пользоваться сводкой · шаг {i + 1} из {STEPS.length}
          </p>
          <p className="mt-3 text-xl md:text-2xl font-semibold text-gray-900 leading-snug">
            <span className="text-[#1F5A25] mr-2">{i + 1}.</span>
            {step.title}
          </p>
          <p className="mt-3 text-[15px] md:text-base text-gray-600 leading-relaxed">{step.text}</p>
          {step.action && (
            <button
              type="button"
              onClick={() => {
                onClose();
                step.action!.run();
              }}
              className="mt-4 self-start text-sm font-semibold text-[#1F5A25] underline underline-offset-2"
            >
              {step.action.label} →
            </button>
          )}

          {/* Все шаги — можно перейти к любому */}
          <ol className="hidden lg:block mt-6 space-y-0.5 overflow-y-auto min-h-0">
            {STEPS.map((s, n) => (
              <li key={s.title}>
                <button
                  onClick={() => setI(n)}
                  className={"w-full text-left flex gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors " + (n === i ? "bg-[#f3f8ee] text-[#1F5A25] font-semibold" : "text-gray-500 hover:bg-gray-50")}
                >
                  <span className={"shrink-0 w-5 h-5 rounded-full text-[11px] flex items-center justify-center " + (n === i ? "bg-[#1F5A25] text-white" : "bg-gray-100 text-gray-500")}>{n + 1}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-6 lg:mt-auto pt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => go(-1)}
              disabled={i === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <ArrowLeft size={16} /> Назад
            </button>
            <div className="flex gap-1.5 lg:hidden" aria-hidden>
              {STEPS.map((_, n) => (
                <span key={n} className={"h-1.5 rounded-full transition-all " + (n === i ? "w-4 bg-[#1F5A25]" : "w-1.5 bg-gray-300")} />
              ))}
            </div>
            <button
              onClick={() => (last ? onClose() : go(1))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5A25] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#174a1c]"
            >
              {last ? "Понятно" : "Далее"} {!last && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
