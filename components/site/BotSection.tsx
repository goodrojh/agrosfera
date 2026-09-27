"use client";

import React from "react";
import { BellRing, ShieldCheck, PackageX, Send } from "lucide-react";
import BotSimulator, { sendToBot } from "@/components/market/BotSimulator";

/** Разбор строки-примера: что означает каждое число */
const PARTS: [string, string][] = [
  ["31500", "цена, ₽/т"],
  ["200", "объём, т"],
  ["8", "влажность, %"],
  ["1.5", "сорная примесь, %"],
  ["46", "масличность, %"],
];

const HELP: { icon: React.ElementType; title: string; text: string }[] = [
  { icon: BellRing, title: "Напомнит", text: "Не ответили до 11:00 — бот напишет ещё раз." },
  { icon: ShieldCheck, title: "Проверит цифры", text: "«30» вместо «30 000» или перепутан порядок — переспросит." },
  { icon: PackageX, title: "Одна кнопка", text: "Нечего продать сегодня — «Сегодня нет в продаже»." },
];

const EXAMPLES: [string, string][] = [
  ["31500 200 8 1.5 46", "правильный ответ"],
  ["30 150 8 1,5 46", "цена в тысячах"],
  ["31500 200 46 1.5 8", "перепутан порядок"],
  ["31500 200", "нет показателей"],
];

/** Для предприятий: как отвечать боту — с живым симулятором в виде Telegram */
export default function BotSection() {
  return (
    <section id="bot" className="bg-[#f4f6f2] py-16 md:py-20 px-4 md:px-8 scroll-mt-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16 items-center">
        <div>
          <h2 className="text-[30px] md:text-[40px] font-semibold tracking-tight text-[#111] leading-[1.1]">Так выглядит бот в Telegram</h2>
          <p className="mt-4 text-gray-600 text-base md:text-lg leading-relaxed max-w-xl">
            Каждый день в 8:00 по вашему времени бот просит предложение. Ответ — одна строка из пяти чисел.
          </p>

          {/* Формат ответа */}
          <div className="mt-7 rounded-2xl bg-white border border-gray-200 p-5 md:p-6">
            <p className="text-sm text-gray-500">Пример ответа</p>
            {/* На телефоне — список «число — что это», на компьютере — пять плиток в ряд */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
              {PARTS.map(([v, l]) => (
                <div key={l} className="flex sm:block items-center justify-between rounded-xl bg-[#f3f8ee] px-4 sm:px-2 py-2.5 sm:py-3 sm:text-center">
                  <p className="font-mono text-lg md:text-xl font-semibold text-[#1F5A25]">{v}</p>
                  <p className="sm:mt-1 text-sm sm:text-xs text-gray-500 leading-tight">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">У пшеницы, ячменя и сои последнее число — протеин.</p>
          </div>

          {/* Что делает бот */}
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {HELP.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl bg-white border border-gray-200 p-4">
                <Icon size={20} className="text-[#1F5A25]" />
                <p className="mt-2 font-semibold text-gray-900">{title}</p>
                <p className="mt-1 text-sm text-gray-600 leading-snug">{text}</p>
              </div>
            ))}
          </div>

          {/* Примеры — отправляются в чат справа */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700">Попробуйте — нажмите, и строка уйдёт в чат:</p>
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {EXAMPLES.map(([text, hint]) => (
                <button
                  key={text}
                  onClick={() => sendToBot(text)}
                  className="group inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left hover:border-[#1F5A25]/40 transition-colors"
                >
                  <Send size={14} className="text-gray-400 group-hover:text-[#1F5A25]" />
                  <span>
                    <span className="block font-mono text-sm text-gray-900">{text}</span>
                    <span className="block text-[11px] text-gray-400">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <BotSimulator />
      </div>
    </section>
  );
}
