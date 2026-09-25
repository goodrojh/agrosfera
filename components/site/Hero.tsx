"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useMarket } from "@/components/market/MarketProvider";
import { computeIndex, lastHistoryDay } from "@/lib/market/aggregate";
import { CROP_BY_ID } from "@/lib/market/crops";
import { pct, rub, tons } from "@/lib/market/format";
import { asset, TELEGRAM_BOT_URL } from "@/lib/config";

const NAV = [
  { label: "Котировки", href: "#terminal" },
  { label: "Инструкция", href: "#instrukciya" },
  { label: "Партнёрам", href: "#partneram" },
  { label: "FAQ", href: "#faq" },
];

export default function Hero({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Видео играет только когда его видно: при прокрутке вниз не тратит ресурсы
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 0.7;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      return;
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const botHref = TELEGRAM_BOT_URL || "#bot";

  // Живая цена прямо на первом экране
  const { ready, latest, history, crop } = useMarket();
  const now = useMemo(() => (ready ? computeIndex([...latest.values()]) : null), [ready, latest]);
  const prev = useMemo(() => {
    const d = lastHistoryDay(history);
    return computeIndex(history.filter((h) => h.day === d));
  }, [history]);
  const change = now && prev ? now.index / prev.index - 1 : null;

  return (
    <section className={"min-h-[88vh] md:min-h-[92vh] flex flex-col bg-[#07160a] relative overflow-hidden " + (className || "")}>
      {/* Video Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={asset("/media/hero.jpg")}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={asset("/media/hero.mp4")} type="video/mp4" />
        </video>
        {/* Overlay для читаемости текста */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07160a]/55 via-[#07160a]/35 to-[#07160a]/70" />
      </div>

      {/* Navigation Bar */}
      <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] md:w-[90%] max-w-5xl">
        <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" as const }}>
          <div className="relative flex items-center justify-between p-[8px] md:p-[10px] rounded-full bg-[#07160a]/45 border border-white/10">
            <a href="#" className="flex items-center gap-2.5 pl-1.5">
              <img src={asset("/brand/emblem.png")} alt="АгроСфера" className="h-8 w-8 md:h-9 md:w-9 rounded-full ring-1 ring-white/20" />
              <span className="text-white font-semibold tracking-[0.14em] text-[13px] md:text-[15px]">АГРОСФЕРА</span>
            </a>

            <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
              {NAV.map((item) => (
                <a key={item.href} href={item.href} className="text-[15px] font-medium text-white/70 hover:text-white transition-colors relative group">
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all group-hover:w-full" />
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <a href={botHref} className="hidden lg:block text-[15px] font-medium text-white/70 hover:text-white transition-colors px-3 py-2">
                Подать цену
              </a>
              <a
                href="#zayavka"
                className="rounded-full px-4 md:px-5 py-2 text-sm md:text-[15px] font-semibold bg-white text-[#0d2410] hover:bg-white/90 transition-all hover:scale-105 active:scale-95"
              >
                Оставить заявку
              </a>
            </div>
          </div>
        </motion.nav>
      </div>

      {/* Hero Content */}
      <div className="relative flex-1 flex flex-col items-center text-center px-4 md:px-6 pt-[128px] md:pt-[170px] pb-16 z-10 justify-center">
        <div className="flex flex-col items-center w-full">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" as const }}
            className="text-center font-semibold text-[40px] sm:text-5xl md:text-6xl lg:text-[62px] leading-[1.08] tracking-[-0.02em] text-white max-w-4xl mt-0 mb-4"
          >
            Агрорынок
            <br />в <span className="italic text-[#C3E79A]">реальных цифрах</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" as const }}
            className="text-center text-base md:text-lg text-white/85 max-w-[560px] leading-relaxed mb-8"
          >
            Цены и свободные объёмы производителей — каждое утро, из первых рук. Выберите культуру, направление экспорта и регион.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" as const }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <a
                href="#terminal"
                className="rounded-full px-8 py-4 text-base font-semibold bg-white/15 border border-white/25 text-white hover:bg-white/20 transition-all shadow-2xl hover:scale-105 active:scale-95"
                style={{ boxShadow: "0 8px 32px 0 rgba(28, 80, 34, 0.45)" }}
              >
                Открыть котировки
              </a>
              <a href={botHref} className="rounded-full px-6 py-4 text-base font-medium text-white/80 hover:text-white transition-colors">
                Я производитель — подать цену →
              </a>
            </div>
          </motion.div>

          {/* Живая цена */}
          <motion.a
            href="#terminal"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" as const }}
            className="mt-10 inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-6 rounded-2xl bg-white px-6 py-4 shadow-2xl hover:scale-[1.02] transition-transform"
          >
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 rounded-full bg-[#4f9a2a] agr-pulse" />
              {CROP_BY_ID[crop].name} сегодня
            </span>
            <span className="text-2xl font-bold tabular-nums text-[#111]">{now ? `${rub(now.index)} ₽/т` : "—"}</span>
            {change !== null && (
              <span className={"inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums " + (change >= 0 ? "text-[#2f7a1f]" : "text-[#c0492f]")}>
                {change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {pct(change)}
              </span>
            )}
            <span className="text-sm text-gray-500 tabular-nums">{now ? `свободно ${tons(now.volume)}` : ""}</span>
          </motion.a>
        </div>
      </div>
    </section>
  );
}
