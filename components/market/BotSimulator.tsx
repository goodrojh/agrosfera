"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SendHorizontal } from "lucide-react";
import { SIM_COMPANY_ID, useMarket } from "@/components/market/MarketProvider";
import { referenceInfo } from "@/lib/market/aggregate";
import { GREETING, replyToButton, replyToText, type BotReply, type ButtonId, type Pending } from "@/lib/market/dialog";
import { REGIONS, REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { asset } from "@/lib/config";
import type { Quote } from "@/lib/market/types";

interface Msg {
  id: number;
  from: "bot" | "user";
  text: string;
  buttons?: BotReply["buttons"];
  used?: boolean;
}

const EMPTY_LATEST = new Map<string, Quote>();
const EXAMPLES = ["31500 200", "30 150", "325000 150", "46000 120"];

export default function BotSimulator() {
  const { latest: marketLatest, crop, submitFromSimulator, mode } = useMarket();
  // Бот принимает цены на лён — сравниваем только с рынком льна
  const latest = crop === "flax" ? marketLatest : EMPTY_LATEST;
  const [region, setRegion] = useState<RegionId>("omsk");
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const pendingRef = useRef<Pending | undefined>(undefined);
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const ctx = () => {
    const ref = referenceInfo(latest, region, SIM_COMPANY_ID);
    return {
      regionName: REGION_BY_ID[region].name,
      reference: ref?.price,
      referenceScope: ref?.scope,
      previous: latest.get(SIM_COMPANY_ID)?.price,
    };
  };

  const botSay = (reply: BotReply) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      pendingRef.current = reply.pending;
      if (reply.accept) submitFromSimulator(region, reply.accept.price, reply.accept.volume, reply.accept.moderation);
      setMsgs((m) => [...m, { id: idRef.current++, from: "bot", text: reply.text, buttons: reply.buttons }]);
    }, 550);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || typing) return;
    setMsgs((m) => [...m.map((x) => ({ ...x, used: true })), { id: idRef.current++, from: "user", text: t }]);
    setInput("");
    botSay(replyToText(t, ctx()));
  };

  const press = (msgId: number, id: ButtonId, label: string) => {
    if (typing) return;
    setMsgs((m) => [...m.map((x) => (x.id === msgId ? { ...x, used: true } : x)), { id: idRef.current++, from: "user", text: label }]);
    botSay(replyToButton(id, pendingRef.current, ctx()));
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[460px]">
      {/* Шапка чата */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-[#f7f9f4]">
        <div className="flex items-center gap-3 min-w-0">
          <img src={asset("/brand/emblem.png")} alt="" className="w-9 h-9 rounded-full" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">АгроСфера · бот котировок</p>
            <p className="text-[11px] text-[#1F5A25]">{typing ? "печатает…" : "Telegram · MAX"}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
          <span className="hidden sm:inline">Регион</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionId)}
            className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1F5A25]/30"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Сообщения */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#eef3e8] max-h-[420px]">
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={"flex flex-col " + (m.from === "user" ? "items-end" : "items-start")}
            >
              <div
                className={
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm " +
                  (m.from === "user" ? "bg-[#1F5A25] text-white rounded-br-md" : "bg-white text-gray-800 rounded-bl-md")
                }
              >
                {m.text}
              </div>
              {m.buttons && (
                <div className="flex flex-wrap gap-2 mt-2 max-w-[85%]">
                  {m.buttons.map((b) => (
                    <button
                      key={b.id}
                      disabled={m.used}
                      onClick={() => press(m.id, b.id, b.label)}
                      className="text-xs font-semibold rounded-xl px-3 py-2 bg-white border border-[#1F5A25]/20 text-[#1F5A25] hover:bg-[#1F5A25] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#1F5A25]"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <div className="flex gap-1 bg-white rounded-2xl rounded-bl-md px-3.5 py-3 w-fit shadow-sm">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
      </div>

      {/* Быстрые примеры + ввод */}
      <div className="border-t border-gray-100 p-3 space-y-2.5 bg-white">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-gray-400 shrink-0 self-center">Попробуйте:</span>
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => send(e)}
              className="shrink-0 text-[11px] font-mono rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:border-[#1F5A25]/40 hover:text-[#1F5A25] transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Например: 31500 200"
            inputMode="text"
            className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/20 focus:border-[#1F5A25]/40"
          />
          <button type="submit" className="w-10 h-10 rounded-xl bg-[#1F5A25] text-white flex items-center justify-center hover:bg-[#174a1c] transition-colors shrink-0" aria-label="Отправить">
            <SendHorizontal size={18} />
          </button>
        </form>
        <p className="text-[10px] text-gray-400">
          {mode === "demo" ? "Симулятор: так же ответит настоящий бот. Принятая цена попадает в стакан котировок." : "Симулятор для знакомства: данные не отправляются в бот."}
        </p>
      </div>
    </div>
  );
}
