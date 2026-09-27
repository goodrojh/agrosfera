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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Инструкция">
      {/* Окно почти во весь экран: крупный скриншот слева, крупный текст справа */}
      <div
        className="relative w-full max-w-[1560px] max-h-full overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col lg:flex-row lg:h-[min(92vh,900px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Закрыть" className="absolute right-4 top-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-gray-500 bg-white/90 hover:bg-gray-100">
          <X size={20} />
        </button>

        {/* Скриншот */}
        <div className="flex-1 min-w-0 min-h-0 h-[42vh] lg:h-auto flex items-center justify-center p-3 md:p-6 bg-[#eef2ea]">
          {/* Скругление, тень и рамка — у самой картинки, поэтому углы чистые */}
          <img
            key={step.image}
            src={asset(step.image)}
            alt={step.title}
            className="block max-w-full max-h-full w-auto h-auto rounded-xl bg-white shadow-[0_8px_30px_-12px_rgba(16,40,20,0.35)] ring-1 ring-black/5 agr-fade"
          />
        </div>

        {/* Текст и управление */}
        <div className="lg:w-[430px] xl:w-[470px] shrink-0 flex flex-col p-6 md:p-10 lg:border-l border-gray-100">
          <p className="text-[15px] font-medium text-[#1F5A25] pr-12">
            Шаг {i + 1} из {STEPS.length}
          </p>

          <div className="flex-1 flex flex-col justify-center py-6 lg:py-8">
            <h3 className="text-[26px] md:text-[32px] font-semibold text-gray-900 leading-tight tracking-tight">{step.title}</h3>
            <p className="mt-5 text-[17px] md:text-[19px] text-gray-600 leading-[1.65]">{step.text}</p>
            {step.action && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  step.action!.run();
                }}
                className="mt-6 self-start inline-flex items-center rounded-xl border border-[#1F5A25]/30 px-5 py-3 text-base font-semibold text-[#1F5A25] hover:bg-[#f3f8ee]"
              >
                {step.action.label} →
              </button>
            )}
          </div>

          {/* Прогресс: точки — можно перейти к любому шагу */}
          <div className="flex gap-2 mb-5" role="tablist" aria-label="Шаги инструкции">
            {STEPS.map((s, n) => (
              <button
                key={s.title}
                role="tab"
                aria-selected={n === i}
                aria-label={`Шаг ${n + 1}: ${s.title}`}
                onClick={() => setI(n)}
                className={"h-2 rounded-full transition-all " + (n === i ? "w-8 bg-[#1F5A25]" : n < i ? "w-2 bg-[#1F5A25]/40" : "w-2 bg-gray-300 hover:bg-gray-400")}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => go(-1)}
              disabled={i === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <ArrowLeft size={18} /> Назад
            </button>
            <button
              onClick={() => (last ? onClose() : go(1))}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5A25] text-white px-6 py-3.5 text-base font-semibold hover:bg-[#174a1c]"
            >
              {last ? "Понятно" : "Далее"} {!last && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
