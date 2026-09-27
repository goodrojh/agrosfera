"use client";

import React from "react";
import BotSimulator from "@/components/market/BotSimulator";

/** Для предприятий: как присылать предложение через бота — с живым симулятором */
export default function BotSection() {
  return (
    <section id="bot" className="bg-[#f6f8f2] py-20 md:py-24 px-4 md:px-8 scroll-mt-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-[#111] leading-[1.1]">Предприятию — одно сообщение в день</h2>
          <p className="mt-5 text-gray-600 text-base md:text-lg leading-relaxed max-w-md">
            Каждый день в 8:00 по вашему времени бот в Telegram просит предложение. Ответ — одной строкой: цена, объём, влажность, сорная примесь, масличность. Например: «31500 200 8 1.5 46».
          </p>
          <ul className="mt-6 space-y-2.5 text-gray-600">
            <li>• Не ответили до 11:00 — бот напомнит один раз.</li>
            <li>• «30» вместо «30 000» или перепутан порядок чисел — бот переспросит.</li>
            <li>• Сегодня нечего продать — кнопка «Сегодня нет в продаже».</li>
          </ul>
          <p className="mt-6 text-sm text-gray-400">Попробуйте справа — симулятор работает как настоящий бот.</p>
        </div>
        <div className="flex flex-col min-h-[520px]">
          <BotSimulator />
        </div>
      </div>
    </section>
  );
}
