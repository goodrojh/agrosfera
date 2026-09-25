"use client";

import React from "react";
import BotSimulator from "@/components/market/BotSimulator";

/** Для производителей: как подать цену через бота — с живым симулятором */
export default function BotSection() {
  return (
    <section id="bot" className="bg-[#f6f8f2] py-20 md:py-24 px-4 md:px-8 scroll-mt-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-[#111] leading-[1.1]">Цены — одним сообщением в Telegram</h2>
          <p className="mt-5 text-gray-600 text-base md:text-lg leading-relaxed max-w-md">
            Предприятию не обязательно заходить на сайт: каждое утро бот спрашивает цену и объём по вашим культурам. Ответ — например, «31500 200».
          </p>
          <ul className="mt-6 space-y-2.5 text-gray-600">
            <li>• «30» вместо «30 000» или лишний ноль — бот переспросит.</li>
            <li>• Цена далеко от рынка — попросит подтвердить.</li>
            <li>• Бот подключается из личного кабинета после проверки компании.</li>
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
