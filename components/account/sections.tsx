"use client";

import React, { useState } from "react";
import { Check, Clock, Send, X } from "lucide-react";
import { api, type Account, type MatchStatus } from "@/lib/account";
import { TELEGRAM_BOT_URL } from "@/lib/config";
import { CROPS, CROP_BY_ID, type CropId } from "@/lib/market/crops";
import { REGION_BY_ID } from "@/lib/market/regions";
import { rub, time, dateShort } from "@/lib/market/format";
import { field } from "./AuthForm";

export const card = "rounded-2xl border border-gray-200 bg-white p-5 md:p-6";
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

export function Pending({ account }: { account: Account }) {
  const steps = [
    ["Анкета отправлена", true],
    ["Менеджер звонит и проверяет компанию", false],
    [account.role === "producer" ? "Открываем доступ: подаёте цены на сайте и в боте" : "Открываем доступ: ставите заявки и покупаете по ценам предприятий", false],
  ] as const;
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-[#9a6b00]">
        <Clock size={18} />
        <p className="font-semibold">Анкета на проверке</p>
      </div>
      <p className="mt-2 text-gray-600">
        Обычно проверка занимает до одного рабочего дня. Менеджер позвонит по номеру {account.phone}. Пока можно смотреть котировки в разделе «Терминал».
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map(([t, done], i) => (
          <li key={t} className="flex items-center gap-3 text-sm">
            <span className={"w-7 h-7 rounded-full flex items-center justify-center shrink-0 " + (done ? "bg-[#1F5A25] text-white" : "bg-gray-100 text-gray-500")}>
              {done ? <Check size={15} /> : i + 1}
            </span>
            <span className={done ? "text-gray-900" : "text-gray-600"}>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Предприятие: цены по закреплённым культурам ──

export function ProducerPrices({ account }: { account: Account }) {
  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-gray-900">Мои цены сегодня</h2>
      <p className="text-sm text-gray-500">₽ за тонну с НДС, самовывоз со склада. Цена видна в стакане без названия предприятия.</p>
      {account.crops.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">Культуры ещё не закреплены — менеджер добавит их после звонка.</p>
      ) : (
        <div className="mt-4 divide-y divide-gray-100">
          {account.crops.map((c) => (
            <PriceRow key={c} crop={c} current={account.quotesToday.find((q) => q.crop === c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PriceRow({ crop, current }: { crop: CropId; current?: Account["quotesToday"][number] }) {
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState(current?.volume ? String(current.volume) : "");
  const [issues, setIssues] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const send = async (confirm = false) => {
    setSending(true);
    setMsg(null);
    try {
      const r = await api<{ needConfirm?: boolean; issues?: string[]; moderation?: boolean }>("/api/cabinet/quote", {
        crop,
        price: Number(price),
        volume: Number(volume),
        confirm,
      });
      if (r.needConfirm) setIssues(r.issues ?? []);
      else {
        setIssues(null);
        setPrice("");
        setMsg({ ok: true, text: r.moderation ? "Цена заметно отличается от рынка — отправили на проверку менеджеру." : "Цена в стакане." });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setSending(false);
  };

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="w-36">
          <p className="font-medium text-gray-900">{CROP_BY_ID[crop].name}</p>
          <p className="text-xs text-gray-500 tabular-nums">
            {current?.price ? `${rub(current.price)} ₽/т · ${rub(current.volume ?? 0)} т · ${time(current.at!)}` : "сегодня ещё нет цены"}
          </p>
        </div>
        <form
          className="flex flex-1 min-w-[260px] items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input value={price} onChange={(e) => (setPrice(digits(e.target.value)), setIssues(null))} inputMode="numeric" placeholder="Цена, ₽/т" className={field + " tabular-nums"} />
          <input value={volume} onChange={(e) => (setVolume(digits(e.target.value)), setIssues(null))} inputMode="numeric" placeholder="Объём, т" className={field + " tabular-nums"} />
          <button disabled={sending || !price || !volume} className="shrink-0 rounded-xl bg-[#1F5A25] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#184a1d] disabled:opacity-50">
            {current?.price ? "Обновить" : "Подать"}
          </button>
        </form>
      </div>
      {issues && (
        <div className="mt-3 rounded-xl bg-[#fff8e6] px-4 py-3 text-sm text-gray-700">
          {issues.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <div className="mt-2 flex gap-2">
            <button onClick={() => void send(true)} disabled={sending} className="rounded-lg bg-[#1F5A25] text-white px-3 py-1.5 text-sm font-medium">
              Да, всё верно
            </button>
            <button onClick={() => setIssues(null)} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-white">
              Исправить
            </button>
          </div>
        </div>
      )}
      {msg && <p className={"mt-2 text-sm " + (msg.ok ? "text-[#1F5A25]" : "text-[#c0492f]")}>{msg.text}</p>}
    </div>
  );
}

export function BotCard({ account }: { account: Account }) {
  const link = account.botLink ?? TELEGRAM_BOT_URL;
  return (
    <div className={card}>
      <h3 className="font-semibold text-gray-900">Telegram-бот</h3>
      {account.botConnected ? (
        <p className="mt-1 text-sm text-gray-600">Подключён. Каждое утро бот спросит цены по вашим культурам — отвечать можно прямо в чате.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600">Подключите бота — он будет каждое утро спрашивать цены, не нужно заходить на сайт.</p>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#229ED9] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#1c8cc2]">
              <Send size={15} /> Подключить бота
            </a>
          )}
        </>
      )}
    </div>
  );
}

// ── Экспортёр и агент: заявки на покупку ──

const BID_STATUS = { pending: "на проверке", active: "в стакане", removed: "снята" } as const;

export function BuyerBids({ account }: { account: Account }) {
  const [crop, setCrop] = useState<CropId>("flax");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const bids = [...account.bids].sort((a, b) => b.at - a.at);
  const live = bids.filter((b) => b.status !== "removed");
  const old = bids.filter((b) => b.status === "removed").slice(0, 5);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    try {
      await api("/api/cabinet/bids", { crop, price: Number(price), volume: Number(volume), regions: [] });
      setPrice("");
      setVolume("");
      setMsg({ ok: true, text: "Заявка отправлена. Менеджер проверит её и поставит в стакан." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
    setSending(false);
  };

  const cancel = async (id: string) => {
    if (!confirm("Снять заявку?")) return;
    await api(`/api/cabinet/bids/${id}/cancel`, {}).catch((e) => alert((e as Error).message));
  };

  return (
    <>
      <form onSubmit={submit} className={card}>
        <h2 className="text-lg font-semibold text-gray-900">Новая заявка на покупку</h2>
        <p className="text-sm text-gray-500">Появится в стакане покупателей после проверки. Предприятия видят цену и объём, но не вашу компанию.</p>
        <div className="mt-4 grid sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2">
          <select value={crop} onChange={(e) => setCrop(e.target.value as CropId)} className={field}>
            {CROPS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input value={price} onChange={(e) => setPrice(digits(e.target.value))} inputMode="numeric" placeholder="Цена, ₽/т" className={field + " tabular-nums"} />
          <input value={volume} onChange={(e) => setVolume(digits(e.target.value))} inputMode="numeric" placeholder="Объём, т" className={field + " tabular-nums"} />
          <button disabled={sending || !price || !volume} className="rounded-xl bg-[#2f7a1f] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#276719] disabled:opacity-50">
            Поставить
          </button>
        </div>
        {msg && <p className={"mt-3 text-sm " + (msg.ok ? "text-[#1F5A25]" : "text-[#c0492f]")}>{msg.text}</p>}
      </form>

      <div className={card}>
        <h2 className="text-lg font-semibold text-gray-900">Мои заявки</h2>
        {live.length === 0 && old.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Заявок пока нет.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="font-normal pb-2">Культура</th>
                <th className="font-normal pb-2 text-right">Цена, ₽/т</th>
                <th className="font-normal pb-2 text-right">Объём, т</th>
                <th className="font-normal pb-2 pl-4">Статус</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...live, ...old].map((b) => (
                <tr key={b.id} className={b.status === "removed" ? "text-gray-400" : "text-gray-900"}>
                  <td className="py-2.5">
                    {CROP_BY_ID[b.crop ?? "flax"].name}
                    <span className="block text-xs text-gray-400">{dateShort(b.at)}</span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium">{rub(b.price)}</td>
                  <td className="py-2.5 text-right tabular-nums">{rub(b.volume)}</td>
                  <td className="py-2.5 pl-4">
                    <span className={b.status === "active" ? "text-[#1F5A25]" : b.status === "pending" ? "text-[#9a6b00]" : ""}>{BID_STATUS[b.status]}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    {b.status !== "removed" && (
                      <button onClick={() => void cancel(b.id)} aria-label="Снять заявку" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-[#c0492f] hover:bg-gray-50">
                        <X size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Совпадения: показываем после того, как менеджер сообщил сторонам ──

const MATCH_STATUS: Record<MatchStatus, string> = { new: "новое", working: "менеджер ведёт сделку", done: "сделка проведена", rejected: "не состоялась" };

export function Matches({ account }: { account: Account }) {
  return (
    <div className={card}>
      <h3 className="font-semibold text-gray-900">Совпадения</h3>
      {account.matches.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">
          {account.role === "producer"
            ? "Когда покупатель предложит вашу цену или выше, менеджер свяжется с вами и совпадение появится здесь."
            : "Когда предприятие поставит цену не выше вашей заявки, менеджер свяжется с вами и совпадение появится здесь."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {account.matches.map((m) => (
            <li key={m.id} className="rounded-xl bg-[#f1f7ec] px-4 py-3">
              <p className="text-sm font-medium text-gray-900">
                {CROP_BY_ID[m.crop].name} · <span className="tabular-nums">{rub(m.price)} ₽/т</span>
              </p>
              <p className="text-xs text-gray-600">
                {m.side === "sell" ? "Покупатель" : "Предприятие"} · {rub(m.volume)} т · {REGION_BY_ID[m.regionId]?.name}
              </p>
              <p className="mt-1 text-xs text-[#1F5A25]">{MATCH_STATUS[m.status]}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PasswordCard() {
  const [old, setOld] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/cabinet/password", { old, password: pwd });
          setMsg({ ok: true, text: "Пароль изменён" });
          setOld("");
          setPwd("");
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        }
      }}
    >
      <h3 className="font-semibold text-gray-900">Смена пароля</h3>
      <input value={old} onChange={(e) => setOld(e.target.value)} type="password" autoComplete="current-password" placeholder="Текущий пароль" className={field + " mt-3"} />
      <input value={pwd} onChange={(e) => setPwd(e.target.value)} type="password" autoComplete="new-password" placeholder="Новый — от 8 символов" className={field + " mt-2"} />
      {msg && <p className={"mt-2 text-sm " + (msg.ok ? "text-[#1F5A25]" : "text-[#c0492f]")}>{msg.text}</p>}
      <button className="mt-3 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Сохранить</button>
    </form>
  );
}
