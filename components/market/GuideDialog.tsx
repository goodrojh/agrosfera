"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { asset } from "@/lib/config";

interface Step {
  title: string;
  text: string;
  image: string;
  link?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    title: "Выберите культуру",
    text: "Слева — список культур. Нажмите на нужную, и окно покажет её рынок: цены, объёмы и заявки.",
    image: "/guide/1-crops.webp",
  },
  {
    title: "Выберите регион",
    text: "По умолчанию — все регионы. Начните вводить название в поле «Все регионы» и отметьте нужные галочками — можно несколько.",
    image: "/guide/2-region.webp",
  },
  {
    title: "…или отметьте регионы на карте",
    text: "Нажмите «На карте» и кликайте по регионам — они обведутся. Чем темнее регион, тем дешевле. Затем «Применить».",
    image: "/guide/5-map.webp",
  },
  {
    title: "Следите за ценой",
    text: "Вверху окна — средняя цена продавцов и изменение к вчера. График показывает, как менялась цена: за день, неделю, месяц или 3 месяца.",
    image: "/guide/3-chart.webp",
  },
  {
    title: "Читайте стакан",
    text: "Справа, красным — цены предприятий, которые продают: сверху самая низкая. Слева, зелёным — заявки экспортёров и агентов, которые покупают: сверху самая высокая. В центре — спред, разница между лучшими ценами. Полоса в строке — объём.",
    image: "/guide/4-book.webp",
  },
  {
    title: "Купить или продать по цене из стакана",
    text: "Экспортёру и агенту — нажмите на цену предприятия. Предприятию — на заявку покупателя. Запрос придёт нам: проверим стороны и проведём сделку через АгроСферу.",
    image: "/guide/6-deal.webp",
  },
  {
    title: "Поставьте свою заявку",
    text: "Не нашли подходящей цены? Нажмите «Поставить заявку в стакан»: цена, объём, регионы. После проверки менеджером заявка появится в стакане — производители её увидят.",
    image: "/guide/7-bid.webp",
  },
  {
    title: "Производителю: цены через бота",
    text: "Заполните анкету на странице «Сотрудничество». После разговора с менеджером откроем доступ — и каждое утро бот в Telegram будет спрашивать цены по вашим культурам. Ответ — цена и объём, например «31500 200».",
    image: "/guide/8-bot.webp",
    link: { label: "Заполнить анкету", href: "/sotrudnichestvo/?role=producer#zayavka" },
  },
];

/** Пошаговая инструкция к терминалу со скриншотами */
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
      <div className="w-full max-w-6xl max-h-full overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-5 md:px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-lg font-semibold text-gray-900">Как пользоваться котировками</p>
            <p className="text-sm text-gray-500">
              Шаг {i + 1} из {STEPS.length} · листайте стрелками
            </p>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="grid lg:grid-cols-[230px_1fr] min-h-0 flex-1 overflow-y-auto">
          {/* Список шагов */}
          <ol className="hidden lg:block border-r border-gray-100 p-3 space-y-1">
            {STEPS.map((s, n) => (
              <li key={s.title}>
                <button
                  onClick={() => setI(n)}
                  className={
                    "w-full text-left flex gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors " +
                    (n === i ? "bg-[#f3f8ee] text-[#1F5A25] font-semibold" : "text-gray-600 hover:bg-gray-50")
                  }
                >
                  <span
                    className={
                      "shrink-0 w-5 h-5 rounded-full text-[11px] flex items-center justify-center " + (n === i ? "bg-[#1F5A25] text-white" : "bg-gray-100 text-gray-500")
                    }
                  >
                    {n + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>

          {/* Шаг */}
          <div className="p-4 md:p-6 flex flex-col gap-5 min-w-0">
            <div className="rounded-xl bg-[#f5f7f2] border border-gray-100 flex items-center justify-center p-3 md:p-4 min-h-[220px]">
              <img key={step.image} src={asset(step.image)} alt={step.title} className="max-h-[52vh] w-auto max-w-full rounded-lg shadow-sm agr-fade" />
            </div>
            <div>
              <p className="text-xl font-semibold text-gray-900">
                <span className="text-[#1F5A25] mr-2">{i + 1}.</span>
                {step.title}
              </p>
              <p className="mt-2 text-gray-600 leading-relaxed max-w-3xl">{step.text}</p>
              {step.link && (
                <a href={asset(step.link.href)} className="mt-3 inline-block text-sm font-semibold text-[#1F5A25] underline underline-offset-2">
                  {step.link.label} →
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-3.5 border-t border-gray-100">
          <button
            onClick={() => go(-1)}
            disabled={i === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <ArrowLeft size={16} /> Назад
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, n) => (
              <span key={n} className={"h-1.5 rounded-full transition-all " + (n === i ? "w-5 bg-[#1F5A25]" : "w-1.5 bg-gray-300")} />
            ))}
          </div>
          <button
            onClick={() => (last ? onClose() : go(1))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5A25] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#174a1c]"
          >
            {last ? "Понятно" : "Далее"} {!last && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
