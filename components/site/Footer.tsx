"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { API_URL, asset, CONTACT_EMAIL, MAX_BOT_URL, TELEGRAM_BOT_URL } from "@/lib/config";
import { LEAD_EVENT, type LeadRole } from "@/lib/lead";
import { DIRECTIONS, REGIONS } from "@/lib/market/regions";

const ROLES: { id: LeadRole; label: string }[] = [
  { id: "exporter", label: "Экспортёр" },
  { id: "agent", label: "Агент" },
  { id: "producer", label: "Производитель" },
];

const inputCls =
  "w-full bg-[#15291a] border border-[#2c4131] rounded-[10px] px-4 py-3.5 text-white text-[14px] placeholder-[#6f806f] outline-none focus:border-[#8CC152]/60 transition-colors";

export default function Footer({ className }: { className?: string }) {
  const [role, setRole] = useState<LeadRole>("exporter");
  const [form, setForm] = useState({ name: "", contact: "", target: "china", volume: "", comment: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const onLead = (e: Event) => {
      const r = (e as CustomEvent<LeadRole>).detail;
      setRole(r);
      setForm((f) => ({ ...f, target: r === "producer" ? "omsk" : "china" }));
      setState("idle");
    };
    window.addEventListener(LEAD_EVENT, onLead);
    return () => window.removeEventListener(LEAD_EVENT, onLead);
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2 || form.contact.trim().length < 5) {
      setError("Укажите имя или компанию и телефон / Telegram.");
      return;
    }
    setError("");
    setState("sending");
    const payload = { role, ...form, volume: form.volume ? Number(form.volume) : null };
    if (!API_URL) {
      await new Promise((r) => setTimeout(r, 600));
      setState("done");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
    } catch {
      setState("error");
      setError("Не удалось отправить. Попробуйте ещё раз или напишите нам в бот.");
    }
  };

  const botHref = TELEGRAM_BOT_URL || "#bot";
  const maxHref = MAX_BOT_URL || "#bot";

  const columns = [
    { title: "Инструмент", links: [["Котировки", "#terminal"], ["Инструкция", "#instrukciya"], ["Методика", "#metodika"], ["FAQ", "#faq"]] },
    { title: "Партнёрам", links: [["Производителям", "#partneram"], ["Экспортёрам", "#partneram"], ["Агентам", "#partneram"]] },
    { title: "Бот", links: [["Telegram", botHref], ["MAX", maxHref], ["Симулятор", "#bot"]] },
    { title: "Контакты", links: CONTACT_EMAIL ? [[CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`], ["Оставить заявку", "#zayavka"]] : [["Оставить заявку", "#zayavka"]] },
  ];

  return (
    <footer className={"w-full pt-20 bg-[#f6f8f2] " + (className || "")}>
      <div className="w-full bg-[#07160a] overflow-hidden">
        {/* Заявка */}
        <div id="zayavka" className="px-4 md:px-20 py-14 md:py-16 grid lg:grid-cols-[1fr_1.4fr] gap-10 border-b border-[#1d3322] scroll-mt-6">
          <div>
            <h2 className="text-white font-bold text-[28px] md:text-[34px] leading-[1.2] max-w-[360px] mb-4">Оставить заявку</h2>
            <p className="text-[#9aab98] text-[15px] leading-relaxed max-w-[380px]">
              Экспортёру — подберём объём и рассчитаем цену с доставкой. Агенту — пришлём договор. Производителю — подключим к боту.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {state === "done" ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[#8CC152]/30 bg-[#8CC152]/10 p-6 md:p-8 text-white"
              >
                <p className="text-xl font-semibold mb-2">✓ Заявка принята</p>
                <p className="text-[#b9c8b6] text-sm leading-relaxed">
                  {API_URL
                    ? "Менеджер свяжется с вами в рабочее время."
                    : "Сейчас сайт работает в демо-режиме: заявка не отправлена. После подключения сервера заявки будут приходить менеджеру в Telegram."}
                </p>
                <button onClick={() => setState("idle")} className="mt-5 text-sm text-[#C3E79A] hover:text-white transition-colors">
                  Отправить ещё одну →
                </button>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="flex gap-2 bg-[#15291a] p-1 rounded-xl border border-[#2c4131] w-full sm:w-fit">
                  {ROLES.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => {
                        setRole(r.id);
                        setForm((f) => ({ ...f, target: r.id === "producer" ? "omsk" : "china" }));
                      }}
                      className={
                        "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all " +
                        (role === r.id ? "bg-[#8CC152] text-[#0d2410]" : "text-[#9aab98] hover:text-white")
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className={inputCls} placeholder="Имя или компания" value={form.name} onChange={set("name")} />
                  <input className={inputCls} placeholder="Телефон или @telegram" value={form.contact} onChange={set("contact")} />
                  <select className={inputCls} value={form.target} onChange={set("target")}>
                    {role === "producer"
                      ? REGIONS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))
                      : DIRECTIONS.map((d) => (
                          <option key={d.id} value={d.id}>
                            Направление: {d.name}
                          </option>
                        ))}
                  </select>
                  <input
                    className={inputCls}
                    placeholder={role === "producer" ? "Объём к продаже, т" : "Нужный объём, т"}
                    inputMode="numeric"
                    value={form.volume}
                    onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value.replace(/\D/g, "") }))}
                  />
                </div>
                <textarea className={inputCls + " resize-none"} rows={2} placeholder="Комментарий (необязательно)" value={form.comment} onChange={set("comment")} />
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={state === "sending"}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-[10px] text-[#0d2410] text-[14px] font-bold transition-all cursor-pointer whitespace-nowrap bg-[#8CC152] hover:bg-[#9fd065] disabled:opacity-60"
                  >
                    {state === "sending" ? "Отправляем…" : "Отправить заявку"}
                  </button>
                  <p className="text-[11px] text-[#6f806f] leading-snug">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
                </div>
                {error && <p className="text-sm text-[#F5A897]">{error}</p>}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

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
