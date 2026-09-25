"use client";

import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { asset } from "@/lib/config";

export type SiteSection = "quotes" | "coop" | "about" | "faq";

const NAV: { id: SiteSection; label: string; href: string }[] = [
  { id: "quotes", label: "Котировки", href: "/#terminal" },
  { id: "coop", label: "Сотрудничество", href: "/sotrudnichestvo/" },
  { id: "about", label: "О нас", href: "/o-nas/" },
  { id: "faq", label: "FAQ", href: "/faq/" },
];

/** Шапка сайта: четыре раздела и вход в личный кабинет */
export default function SiteHeader({ active }: { active?: SiteSection }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-50 bg-[#07160a] text-white border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-6">
        <a href={asset("/")} className="flex items-center gap-2.5 shrink-0">
          <img src={asset("/brand/emblem.png")} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/20" />
          <span className="font-semibold tracking-[0.16em] text-[14px]">АГРОСФЕРА</span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={asset(n.href)}
              aria-current={active === n.id ? "page" : undefined}
              className={"text-[15px] transition-colors " + (active === n.id ? "text-white font-medium" : "text-white/60 hover:text-white")}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href={asset("/kabinet/")} className="whitespace-nowrap rounded-lg bg-white text-[#0b1f0e] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors">
            <span className="hidden sm:inline">Личный кабинет</span>
            <span className="sm:hidden">Кабинет</span>
          </a>
          <button onClick={() => setOpen((v) => !v)} aria-label="Меню" aria-expanded={open} className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t border-white/10 px-4 py-2">
          {NAV.map((n) => (
            <a key={n.id} href={asset(n.href)} onClick={() => setOpen(false)} className={"block py-3 text-[15px] " + (active === n.id ? "text-white font-medium" : "text-white/70")}>
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Заголовок внутренней страницы — продолжает тёмную шапку */
export function PageIntro({ title, lead, children }: { title: string; lead: string; children?: React.ReactNode }) {
  return (
    <section className="bg-[#07160a] text-white px-4 md:px-8 pt-12 md:pt-16 pb-14 md:pb-20">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-[36px] md:text-[52px] font-semibold tracking-tight leading-[1.05]">{title}</h1>
        <p className="mt-4 text-[17px] md:text-lg text-white/65 max-w-2xl leading-relaxed">{lead}</p>
        {children}
      </div>
    </section>
  );
}
