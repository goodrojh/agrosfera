"use client";

import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { asset } from "@/lib/config";
import { openRequest } from "@/lib/actions";

export { openRequest };

export type SiteSection = "quotes" | "exporters" | "producers" | "about" | "faq";


const NAV: { id: SiteSection; label: string; href: string }[] = [
  { id: "quotes", label: "Котировки", href: "/#terminal" },
  { id: "exporters", label: "Экспортёрам", href: "/eksporteram/" },
  { id: "producers", label: "Предприятиям", href: "/predpriyatiyam/" },
  { id: "about", label: "О нас", href: "/o-nas/" },
  { id: "faq", label: "FAQ", href: "/faq/" },
];

/** Шапка сайта: разделы и кнопка заявки. transparent — поверх фото первого экрана */
export default function SiteHeader({ active, transparent = false }: { active?: SiteSection; transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className={"relative z-50 text-white border-b border-white/10 " + (transparent ? "bg-transparent" : "bg-[#07160a]")}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-6">
        <a href={asset("/")} className="flex items-center gap-2.5 shrink-0">
          <img src={asset("/brand/emblem.png")} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/20" />
          <span className="font-semibold tracking-[0.16em] text-[14px]">АГРОСФЕРА</span>
        </a>

        <nav className="hidden lg:flex items-center gap-7">
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
          <button onClick={openRequest} className="whitespace-nowrap rounded-lg bg-white text-[#0b1f0e] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors">
            <span className="hidden sm:inline">Оставить заявку</span>
            <span className="sm:hidden">Заявка</span>
          </button>
          <button onClick={() => setOpen((v) => !v)} aria-label="Меню" aria-expanded={open} className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden border-t border-white/10 bg-[#07160a] px-4 py-2">
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

/** Заголовок внутренней страницы: шапка и крупный заголовок поверх фотографии */
export function PageIntro({ title, lead, photo, active, children }: { title: string; lead: string; photo: string; active: SiteSection; children?: React.ReactNode }) {
  return (
    <section className="relative bg-[#07160a] text-white overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        <img src={asset(photo)} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07160a]/95 via-[#07160a]/75 to-[#07160a]/40" />
      </div>
      <div className="relative">
        <SiteHeader active={active} transparent />
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-14 md:pt-20 pb-16 md:pb-24">
          <h1 className="text-[36px] md:text-[54px] font-semibold tracking-tight leading-[1.05]">{title}</h1>
          <p className="mt-4 text-[17px] md:text-lg text-white/75 max-w-2xl leading-relaxed">{lead}</p>
          {children}
        </div>
      </div>
    </section>
  );
}
