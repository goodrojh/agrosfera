"use client";

import React from "react";
import { asset, CONTACT_EMAIL, MAX_BOT_URL, TELEGRAM_BOT_URL } from "@/lib/config";

/** Подвал сайта */
export default function Footer({ className }: { className?: string }) {
  const botHref = TELEGRAM_BOT_URL || asset("/predpriyatiyam/#bot");
  const maxHref = MAX_BOT_URL || asset("/predpriyatiyam/#bot");

  const columns = [
    { title: "Сводка", links: [["Предложения", asset("/#terminal")], ["Оставить заявку", asset("/?zayavka=1#terminal")]] },
    { title: "Партнёрам", links: [["Экспортёрам", asset("/eksporteram/")], ["Предприятиям", asset("/predpriyatiyam/")], ["Стать партнёром", asset("/predpriyatiyam/#partner")]] },
    { title: "Компания", links: [["О нас", asset("/o-nas/")], ["Вопросы и ответы", asset("/faq/")], ...(CONTACT_EMAIL ? [[CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`]] : [])] },
    { title: "Бот для партнёров", links: [["Telegram", botHref], ["MAX", maxHref]] },
  ];

  return (
    <footer className={"w-full " + (className || "")}>
      <div className="w-full bg-[#07160a] overflow-hidden">
        {/* Ссылки */}
        <div className="px-4 md:px-20 py-14 grid grid-cols-2 lg:grid-cols-4 gap-8 border-b border-[#1d3322]">
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col">
              <h3 className="text-white font-bold text-[14px] mb-4">{col.title}</h3>
              <div className="flex flex-col gap-1">
                {col.links.map(([label, href]) => (
                  <a key={label} href={href} className="text-[#86977f] text-[13px] leading-[2.2] hover:text-white transition-colors w-fit">
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Нижняя строка */}
        <div className="px-4 md:px-20 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={asset("/brand/emblem.png")} alt="АгроСфера" className="h-9 w-9 rounded-full" />
            <span className="text-white font-semibold tracking-[0.14em] text-sm">АГРОСФЕРА</span>
          </div>
          <div className="text-[#5f705c] text-[13px] text-center">© 2026 АгроСфера. Сводка носит информационный характер и не является офертой.</div>
          <div className="flex items-center gap-2">
            <a href={botHref} aria-label="Telegram" className="w-9 h-9 rounded-full border border-[#2c4131] flex items-center justify-center hover:bg-[#15291a] hover:border-[#45604a] transition-all group">
              <svg width="16" height="16" viewBox="0 0 24 24" className="fill-[#86977f] group-hover:fill-white transition-colors">
                <path d="M21.94 4.3 18.7 19.6c-.24 1.08-.88 1.35-1.79.84l-4.94-3.64-2.38 2.3c-.26.26-.49.49-1 .49l.36-5.03 9.15-8.27c.4-.35-.09-.55-.62-.2L6.17 13.2l-4.87-1.52c-1.06-.33-1.08-1.06.22-1.57L20.55 2.8c.88-.33 1.65.2 1.39 1.5z" />
              </svg>
            </a>
            <a href={maxHref} aria-label="MAX" className="h-9 px-3 rounded-full border border-[#2c4131] flex items-center justify-center hover:bg-[#15291a] hover:border-[#45604a] transition-all text-[11px] font-bold tracking-wider text-[#86977f] hover:text-white">
              MAX
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
