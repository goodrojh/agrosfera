"use client";

import React, { useEffect } from "react";
import { Lock, X } from "lucide-react";
import { CABINET_URL, type Account } from "@/lib/account";

export interface Gate {
  /** sell — предприятие продаёт, buy — покупатель покупает, bid — заявка на покупку */
  action: "sell" | "buy" | "bid";
  reason: "guest" | "pending" | "role";
}

/** Окно вместо действия: войти, дождаться проверки или сменить роль */
export default function AuthPrompt({ gate, account, onClose }: { gate: Gate; account: Account | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const producer = gate.action === "sell";
  const role = producer ? "producer" : "exporter";
  const text = {
    guest: {
      title: "Войдите в личный кабинет",
      body: producer
        ? "Продавать по цене покупателя и подавать свои цены могут проверенные предприятия. Зарегистрируйтесь — менеджер проверит компанию и откроет доступ."
        : "Ставить заявки и покупать по ценам предприятий могут проверенные экспортёры и агенты. Зарегистрируйтесь — менеджер проверит компанию и откроет доступ.",
    },
    pending: {
      title: "Анкета на проверке",
      body: "Менеджер АгроСферы свяжется с вами и откроет доступ. После этого кнопки заработают.",
    },
    role: {
      title: producer ? "Это действие для предприятий" : "Это действие для экспортёров и агентов",
      body:
        account?.role === "producer"
          ? "Вы вошли как предприятие: свою цену подавайте в личном кабинете, а продать покупателю можно по цене из левой части стакана."
          : "Вы вошли как покупатель: ставьте заявку в стакан или покупайте по цене предприятия из правой части стакана.",
    },
  }[gate.reason];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={text.title}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <span className="w-10 h-10 rounded-full bg-[#f1f7ec] text-[#1F5A25] flex items-center justify-center">
            <Lock size={18} />
          </span>
          <button onClick={onClose} aria-label="Закрыть" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-lg font-semibold text-gray-900">{text.title}</p>
        <p className="mt-1 text-sm text-gray-600">{text.body}</p>
        <div className="mt-5 flex flex-col gap-2">
          {gate.reason === "guest" ? (
            <>
              <a href={`${CABINET_URL}?role=${role}`} className="rounded-xl bg-[#1F5A25] text-white py-2.5 text-center text-sm font-semibold hover:bg-[#184a1d]">
                Зарегистрироваться
              </a>
              <a href={CABINET_URL} className="rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
                У меня есть аккаунт — войти
              </a>
            </>
          ) : (
            <a href={CABINET_URL} className="rounded-xl bg-[#1F5A25] text-white py-2.5 text-center text-sm font-semibold hover:bg-[#184a1d]">
              Открыть личный кабинет
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
