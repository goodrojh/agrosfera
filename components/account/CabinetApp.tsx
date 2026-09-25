"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, CandlestickChart, ClipboardList, Handshake, LogOut, ShieldCheck, Tag, UserRound, type LucideIcon } from "lucide-react";
import { logout, ROLE_LABEL, type Account } from "@/lib/account";
import { asset } from "@/lib/config";
import { REGION_BY_ID } from "@/lib/market/regions";
import MarketProvider from "@/components/market/MarketProvider";
import Terminal from "@/components/site/Terminal";
import { BotCard, BuyerBids, card, Matches, PasswordCard, Pending, ProducerPrices } from "./sections";

type Section = "status" | "terminal" | "prices" | "bids" | "matches" | "profile";

const TITLE: Record<Section, string> = {
  status: "Проверка компании",
  terminal: "Терминал",
  prices: "Мои цены",
  bids: "Мои заявки",
  matches: "Совпадения",
  profile: "Профиль",
};

const ICON: Record<Section, LucideIcon> = {
  status: ShieldCheck,
  terminal: CandlestickChart,
  prices: Tag,
  bids: ClipboardList,
  matches: Handshake,
  profile: UserRound,
};

/** Разделы зависят от роли и статуса: у предприятия — цены, у покупателя — заявки */
function sectionsFor(a: Account): Section[] {
  if (a.status !== "active") return ["status", "terminal", "profile"];
  return a.role === "producer" ? ["terminal", "prices", "matches", "profile"] : ["terminal", "bids", "matches", "profile"];
}

const STATUS_BADGE = {
  new: { text: "на проверке", cls: "bg-amber-400/15 text-amber-300" },
  active: { text: "доступ открыт", cls: "bg-[#8CC152]/15 text-[#b6e08a]" },
  blocked: { text: "доступ закрыт", cls: "bg-red-400/15 text-red-300" },
} as const;

/** Личный кабинет — отдельное рабочее пространство со своим меню */
export default function CabinetApp({ account }: { account: Account }) {
  const sections = sectionsFor(account);
  const [section, setSection] = useState<Section>(sections[0]);

  // Раздел в адресе (#prices) — чтобы можно было обновить страницу и остаться там же
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Section;
      setSection(sections.includes(h) ? h : sections[0]);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.join()]);

  const go = (s: Section) => {
    window.history.replaceState(null, "", `#${s}`);
    setSection(s);
    window.scrollTo(0, 0);
  };

  const openMatches = account.matches.filter((m) => m.status === "new" || m.status === "working").length;
  const badge = STATUS_BADGE[account.status];

  if (account.status === "blocked") {
    return (
      <div className="min-h-screen bg-[#f4f6f2] flex items-center justify-center p-4">
        <div className={card + " max-w-md text-center"}>
          <p className="text-lg font-semibold text-gray-900">Доступ закрыт</p>
          <p className="mt-2 text-sm text-gray-600">Свяжитесь с менеджером АгроСферы.</p>
          <button onClick={() => void logout()} className="mt-5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Выйти
          </button>
        </div>
      </div>
    );
  }

  const nav = (compact: boolean) =>
    sections.map((s) => {
      const Icon = ICON[s];
      const on = section === s;
      const label = TITLE[s];
      return (
        <button
          key={s}
          onClick={() => go(s)}
          aria-current={on}
          className={
            compact
              ? "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                (on ? "bg-white/15 text-white" : "text-white/60 hover:text-white")
              : "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors " +
                (on ? "bg-white/12 text-white" : "text-white/60 hover:text-white hover:bg-white/5")
          }
        >
          <Icon size={compact ? 16 : 18} strokeWidth={1.8} />
          <span className="flex-1 text-left">{label}</span>
          {s === "matches" && openMatches > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#8CC152] text-[#0d2410] text-xs font-bold flex items-center justify-center">{openMatches}</span>
          )}
        </button>
      );
    });

  return (
    <MarketProvider>
      <div className="min-h-screen bg-[#f4f6f2] lg:pl-64">
        {/* Меню слева (компьютер) */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-[#0b1f0e] text-white px-4 py-5">
          <div className="flex items-center gap-2.5 px-2">
            <img src={asset("/brand/emblem.png")} alt="" className="h-9 w-9 rounded-full ring-1 ring-white/20" />
            <div>
              <p className="font-semibold tracking-[0.14em] text-sm leading-tight">АГРОСФЕРА</p>
              <p className="text-[11px] text-white/50">личный кабинет</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-white/5 px-3 py-3">
            <p className="text-[15px] font-semibold leading-snug">{account.name}</p>
            <p className="text-xs text-white/50 mt-0.5">
              {ROLE_LABEL[account.role]} · {account.code}
            </p>
            <span className={"mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + badge.cls}>{badge.text}</span>
          </div>

          <nav className="mt-5 flex flex-col gap-1">{nav(false)}</nav>

          <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
            <a href={asset("/")} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 hover:text-white">
              <ArrowLeft size={16} /> На сайт АгроСферы
            </a>
            <button onClick={() => void logout()} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 hover:text-white">
              <LogOut size={16} /> Выйти
            </button>
          </div>
        </aside>

        {/* Шапка (телефон и планшет) */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#0b1f0e] text-white px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={asset("/brand/emblem.png")} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/20 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{account.name}</p>
                <p className="text-[11px] text-white/50">
                  {ROLE_LABEL[account.role]} · {badge.text}
                </p>
              </div>
            </div>
            <button onClick={() => void logout()} aria-label="Выйти" className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white">
              <LogOut size={17} />
            </button>
          </div>
          <nav className="mt-2 flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4">{nav(true)}</nav>
        </header>

        <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px]">
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-gray-900 mb-5">{TITLE[section]}</h1>

          {section === "status" && (
            <div className="max-w-2xl">
              <Pending account={account} />
            </div>
          )}

          {section === "terminal" && (
            <Terminal inCabinet role={account.status === "active" ? account.role : null} onOwnPrice={() => go("prices")} />
          )}

          {section === "prices" && (
            <div className="max-w-3xl space-y-5">
              <ProducerPrices account={account} />
            </div>
          )}

          {section === "bids" && (
            <div className="max-w-3xl space-y-5">
              <BuyerBids account={account} />
            </div>
          )}

          {section === "matches" && (
            <div className="max-w-2xl">
              <Matches account={account} />
            </div>
          )}

          {section === "profile" && (
            <div className="max-w-3xl grid md:grid-cols-2 gap-5 items-start">
              <div className={card}>
                <h3 className="font-semibold text-gray-900">Компания</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  {[
                    ["Название", account.name],
                    ["Роль", ROLE_LABEL[account.role]],
                    ["ИНН", account.inn || "не указан"],
                    ["Регион", REGION_BY_ID[account.regionId]?.name ?? account.regionId],
                    ["Контакт", account.person],
                    ["Телефон", account.phone],
                    ["Email (логин)", account.email],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="text-gray-900 text-right">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-gray-400">Чтобы изменить данные или культуры, напишите менеджеру АгроСферы.</p>
              </div>
              <div className="space-y-5">
                {account.role === "producer" && account.status === "active" && <BotCard account={account} />}
                <PasswordCard />
              </div>
            </div>
          )}
        </main>
      </div>
    </MarketProvider>
  );
}
