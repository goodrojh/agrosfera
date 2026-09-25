"use client";

import React from "react";
import { asset } from "@/lib/config";

const NAV = [
  { label: "Котировки", href: asset("/#terminal") },
  { label: "Партнёрам", href: "#partneram" },
  { label: "Инструкция", href: "#instrukciya" },
  { label: "Бот", href: "#bot" },
  { label: "Вопросы", href: "#faq" },
];

/** Шапка страницы «Сотрудничество» */
export default function CoopHeader() {
  return (
    <header className="bg-[#07160a] text-white px-4 md:px-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 py-4">
        <a href={asset("/")} className="flex items-center gap-2.5">
          <img src={asset("/brand/emblem.png")} alt="АгроСфера" className="h-9 w-9 rounded-full ring-1 ring-white/20" />
          <span className="font-semibold tracking-[0.14em] text-sm md:text-[15px]">АГРОСФЕРА</span>
        </a>
        <nav className="hidden md:flex items-center gap-7">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[15px] text-white/70 hover:text-white transition-colors">
              {n.label}
            </a>
          ))}
        </nav>
        <a href={asset("/kabinet/")} className="rounded-full bg-white text-[#0d2410] px-4 md:px-5 py-2 text-sm md:text-[15px] font-semibold hover:bg-white/90">
          Личный кабинет
        </a>
      </div>
      <div className="max-w-6xl mx-auto pt-10 pb-16 md:pt-14 md:pb-20">
        <h1 className="text-[40px] md:text-[56px] font-semibold tracking-tight leading-[1.05]">Сотрудничество</h1>
        <p className="mt-4 text-white/75 text-base md:text-lg max-w-xl">
          Производителям, экспортёрам и агентам — как работать с АгроСферой, как подать цену и оставить заявку.
        </p>
      </div>
    </header>
  );
}
