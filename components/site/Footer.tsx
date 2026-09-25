"use client";

import React from "react";
import { asset, CONTACT_EMAIL, MAX_BOT_URL, TELEGRAM_BOT_URL } from "@/lib/config";
import { CABINET_URL } from "@/lib/account";

const JOIN = [
  { role: "producer", title: "Предприятию", text: "Публикуйте цены и продавайте покупателям из стакана." },
  { role: "exporter", title: "Экспортёру", text: "Покупайте напрямую у предприятий по всей России." },
  { role: "agent", title: "Агенту", text: "Закрывайте заказы своих покупателей по договору с АгроСферой." },
];

/** Подвал. withForm — блок регистрации (на странице «Сотрудничество»); на главной только ссылки */
export default function Footer({ className, withForm = true }: { className?: string; withForm?: boolean }) {
  const coop = (hash: string) => asset(`/sotrudnichestvo/${hash}`);
  const botHref = TELEGRAM_BOT_URL || coop("#bot");
  const maxHref = MAX_BOT_URL || coop("#bot");

  const columns = [
    { title: "Инструмент", links: [["Котировки", asset("/#terminal")], ["Личный кабинет", CABINET_URL]] },
    { title: "Сотрудничество", links: [["Предприятиям", coop("#roli")], ["Экспортёрам", coop("#roli")], ["Агентам", coop("#roli")], ["Личный кабинет", coop("#kabinet")]] },
    { title: "Компания", links: [["О нас", asset("/o-nas/")], ["Вопросы и ответы", asset("/faq/")], ...(CONTACT_EMAIL ? [[CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`]] : [])] },
    { title: "Бот", links: [["Telegram", botHref], ["MAX", maxHref]] },
  ];

  return (
    <footer className={"w-full " + (withForm ? "pt-20 bg-[#f6f8f2] " : "") + (className || "")}>
      <div className="w-full bg-[#07160a] overflow-hidden">
        {/* Регистрация */}
        {withForm && (
          <div id="zayavka" className="px-4 md:px-20 py-14 md:py-16 border-b border-[#1d3322] scroll-mt-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-white font-bold text-[28px] md:text-[34px] leading-[1.2] mb-3">Начать работу</h2>
                <p className="text-[#9aab98] text-[15px] leading-relaxed max-w-[520px]">
                  Регистрация — пара минут. Менеджер проверит компанию и откроет доступ к инструменту.
                </p>
              </div>
              <a href={CABINET_URL} className="text-[#C3E79A] text-sm hover:text-white transition-colors whitespace-nowrap">
                Уже есть аккаунт? Войти →
              </a>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {JOIN.map((j) => (
                <a
                  key={j.role}
                  href={`${CABINET_URL}?role=${j.role}`}
                  className="group rounded-2xl border border-[#2c4131] bg-[#0f2213] p-6 hover:border-[#8CC152]/60 transition-colors"
                >
                  <p className="text-white font-semibold text-lg">{j.title}</p>
                  <p className="mt-2 text-[#9aab98] text-sm leading-relaxed">{j.text}</p>
                  <span className="mt-5 inline-block rounded-lg bg-[#8CC152] text-[#0d2410] px-4 py-2 text-sm font-bold group-hover:bg-[#9fd065] transition-colors">
                    Зарегистрироваться
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

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
          <div className="text-[#5f705c] text-[13px] text-center">© 2026 АгроСфера. Котировки носят информационный характер и не являются офертой.</div>
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
