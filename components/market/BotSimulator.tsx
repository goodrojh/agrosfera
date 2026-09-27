"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCheck, MoreVertical, Paperclip, SendHorizontal, Smile } from "lucide-react";
import { SIM_COMPANY_ID, useMarket } from "@/components/market/MarketProvider";
import { referenceInfo } from "@/lib/market/aggregate";
import { formatHint, replyToButton, replyToText, type BotReply, type ButtonId, type Pending } from "@/lib/market/dialog";
import { CROP_BY_ID } from "@/lib/market/crops";
import { REGIONS, REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { asset } from "@/lib/config";
import type { Quote } from "@/lib/market/types";

// Симулятор принимает предложения по льну
const FLAX = CROP_BY_ID.flax;
const GREETING = `Доброе утро! Пришлите, пожалуйста, предложение на сегодня.\n\n${FLAX.name}\n${formatHint(FLAX.quality, FLAX.basePrice)}`;

interface Msg {
  id: number;
  from: "bot" | "user";
  text: string;
  time: string;
  buttons?: BotReply["buttons"];
  used?: boolean;
}

const NO_OFFERS: Quote[] = [];
const EXAMPLES = ["31500 200 8 1.5 46", "31500 200", "30 150 8 1,5 46", "31500 200 46 1.5 8"];
const clock = () => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** Фон чата как в Telegram: светлая «обоина» с узором */
const WALLPAPER: React.CSSProperties = {
  backgroundColor: "#cfdcb8",
  backgroundImage:
    "radial-gradient(circle at 20% 20%, rgba(255,255,255,.35) 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.28) 0 1.5px, transparent 2.5px), linear-gradient(160deg, #d6e3bd 0%, #c3d4a8 55%, #b9cda0 100%)",
  backgroundSize: "34px 34px, 26px 26px, 100% 100%",
};

/** Живой симулятор бота в виде Telegram на телефоне — отвечает так же, как настоящий бот */
export default function BotSimulator() {
  const { offers: marketOffers, crop, submitFromSimulator, mode } = useMarket();
  // Бот принимает предложения по льну — сравниваем только с рынком льна
  const offers = crop === "flax" ? marketOffers : NO_OFFERS;
  const [region, setRegion] = useState<RegionId>("omsk");
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "bot", text: GREETING, time: "08:00" }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const pendingRef = useRef<Pending | undefined>(undefined);
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const ctx = () => {
    const ref = referenceInfo(offers, region, SIM_COMPANY_ID);
    return {
      regionName: REGION_BY_ID[region].name,
      reference: ref?.price,
      referenceScope: ref?.scope,
      previous: offers.find((q) => q.companyId === SIM_COMPANY_ID)?.price,
      quality: FLAX.quality,
      basePrice: FLAX.basePrice,
    };
  };

  const botSay = (reply: BotReply) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      pendingRef.current = reply.pending;
      if (reply.accept) {
        const { moderation, ...offer } = reply.accept;
        submitFromSimulator(region, offer, moderation);
      }
      setMsgs((m) => [...m, { id: idRef.current++, from: "bot", text: reply.text, time: clock(), buttons: reply.buttons }]);
    }, 700);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || typing) return;
    setMsgs((m) => [...m.map((x) => ({ ...x, used: true })), { id: idRef.current++, from: "user", text: t, time: clock() }]);
    setInput("");
    botSay(replyToText(t, ctx()));
  };

  const press = (msgId: number, id: ButtonId, label: string) => {
    if (typing) return;
    setMsgs((m) => [...m.map((x) => (x.id === msgId ? { ...x, used: true } : x)), { id: idRef.current++, from: "user", text: label, time: clock() }]);
    botSay(replyToButton(id, pendingRef.current, ctx()));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        Регион вашего склада
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as RegionId)}
          className="text-sm bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/20"
        >
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {/* Телефон */}
      <div className="w-full max-w-[380px] rounded-[44px] bg-[#111] p-[10px] shadow-[0_30px_70px_-25px_rgba(0,0,0,0.55)]">
        <div className="relative h-[640px] rounded-[36px] overflow-hidden flex flex-col bg-white">
          {/* Шапка чата Telegram */}
          <div className="shrink-0 flex items-center gap-3 px-3 pt-5 pb-2.5 bg-white border-b border-black/5">
            <ArrowLeft size={22} className="text-[#3390ec]" />
            <img src={asset("/brand/emblem.png")} alt="" className="w-10 h-10 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-gray-900 leading-tight truncate">АгроСфера</p>
              <p className={"text-[13px] leading-tight " + (typing ? "text-[#3390ec]" : "text-gray-500")}>{typing ? "печатает…" : "бот"}</p>
            </div>
            <MoreVertical size={20} className="text-gray-500" />
          </div>

          {/* Сообщения */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1.5" style={WALLPAPER}>
            <div className="flex justify-center mb-1">
              <span className="rounded-full bg-black/20 text-white text-[12px] font-medium px-2.5 py-0.5">Сегодня</span>
            </div>
            {msgs.map((m) => (
              <div key={m.id} className={"flex flex-col agr-fade " + (m.from === "user" ? "items-end" : "items-start")}>
                <div
                  className={
                    "relative max-w-[85%] whitespace-pre-line px-2.5 pt-1.5 pb-1 text-[14px] leading-[1.35] text-gray-900 shadow-[0_1px_1px_rgba(0,0,0,0.12)] " +
                    (m.from === "user" ? "bg-[#effdde] rounded-2xl rounded-br-[6px]" : "bg-white rounded-2xl rounded-bl-[6px]")
                  }
                >
                  {m.text}
                  <span className={"float-right ml-2 mt-1.5 inline-flex items-center gap-0.5 text-[11px] leading-none " + (m.from === "user" ? "text-[#5dab60]" : "text-gray-400")}>
                    {m.time}
                    {m.from === "user" && <CheckCheck size={14} />}
                  </span>
                </div>
                {/* Кнопки под сообщением бота — как inline-клавиатура Telegram */}
                {m.buttons && (
                  <div className="mt-1 grid gap-1 w-[85%]" style={{ gridTemplateColumns: `repeat(${Math.min(m.buttons.length, 2)}, minmax(0, 1fr))` }}>
                    {m.buttons.map((b) => (
                      <button
                        key={b.id}
                        disabled={m.used}
                        onClick={() => press(m.id, b.id, b.label)}
                        className="rounded-xl bg-black/15 backdrop-blur-sm px-2 py-2 text-[13px] font-medium text-white hover:bg-black/25 transition-colors disabled:opacity-50"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Поле ввода */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="shrink-0 flex items-center gap-2 px-2.5 py-2 bg-white border-t border-black/5"
          >
            <Smile size={22} className="text-gray-400 shrink-0" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Сообщение"
              className="flex-1 min-w-0 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <Paperclip size={20} className="text-gray-400 shrink-0" />
            <button type="submit" aria-label="Отправить" className="w-9 h-9 rounded-full bg-[#3390ec] text-white flex items-center justify-center shrink-0 hover:bg-[#2b7fd4]">
              <SendHorizontal size={17} />
            </button>
          </form>
        </div>
      </div>

      {/* Быстрые примеры */}
      <div className="w-full max-w-[380px]">
        <p className="text-xs text-gray-500 text-center">Попробуйте отправить:</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => send(e)}
              className="text-xs font-mono rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:border-[#1F5A25]/40 hover:text-[#1F5A25] transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-gray-400 text-center">
          {mode === "demo" ? "Симулятор отвечает так же, как настоящий бот. Принятое предложение появляется в сводке." : "Симулятор для знакомства: данные не отправляются в бот."}
        </p>
      </div>
    </div>
  );
}
