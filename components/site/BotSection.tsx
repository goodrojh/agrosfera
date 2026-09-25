"use client";

import React from "react";
import BotSimulator from "@/components/market/BotSimulator";

/** Для производителей: как подать цену через бота — с живым симулятором */
export default function BotSection() {
  return (
    <section id="bot" className="bg-[#f6f8f2] py-20 md:py-24 px-4 md:px-8 scroll-mt-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <h2 className="text-[32px] md:text-[44px] font-semibold tracking-tight text-[#111] leading-[1.1]">Цена — одним сообщением</h2>
          <p className="mt-5 text-gray-600 text-base md:text-lg leading-relaxed max-w-md">
            Каждое утро пишете боту в Telegram или MAX цену за тонну и свободный объём, например «31500 200». Цена изменилась — пишете снова.
          </p>
          <ul className="mt-6 space-y-2.5 text-gray-600">
            <li>• «30» вместо «30 000» — бот переспросит и предложит исправить.</li>
            <li>• Лишний ноль или цена далеко от рынка — попросит подтвердить.</li>
            <li>• Название предприятия в котировках не показывается.</li>
          </ul>
          <p className="mt-6 text-sm text-gray-400">Попробуйте справа — это симулятор, он работает так же, как настоящий бот.</p>
        </div>
        <div className="flex flex-col min-h-[520px]">
          <BotSimulator />
        </div>
      </div>
    </section>
  );
}
