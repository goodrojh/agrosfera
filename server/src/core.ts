// Логика бота, общая для Telegram и MAX.

import { EventEmitter } from "node:events";
import { mskDay } from "./config.ts";
import { companies, members, quotes, type Channel } from "./db.ts";
import { latestAccepted, referenceInfo } from "../../lib/market/aggregate.ts";
import { GREETING, HELP, replyToButton, replyToText, type ButtonId, type Pending } from "../../lib/market/dialog.ts";
import { handleGuest } from "./registration.ts";
import { checkQuote, parseSubmission } from "../../lib/market/validate.ts";
import { REGION_BY_ID } from "../../lib/market/regions.ts";
import type { Bid, Company, Quote } from "../../lib/market/types.ts";

/** События для SSE-потока сайта */
export const bus = new EventEmitter();
bus.setMaxListeners(1000);

export function publishQuote(q: Quote) {
  bus.emit("quote", q);
}
export function publishCompany(c: Company) {
  bus.emit("company", c);
}
export function publishBid(b: Bid) {
  bus.emit("bid", b);
}

export interface Incoming {
  channel: Channel;
  userId: string;
  userName?: string;
  /** @username в мессенджере — для модератора */
  userHandle?: string;
  text?: string;
  /** Нажатая кнопка: «b:confirm», «reg:start», «reg:region:omsk»… */
  button?: string;
  /** Номер из кнопки «Отправить номер» */
  phone?: string;
  /** Код приглашения из deep link (/start CODE) */
  startPayload?: string;
}

export interface Outgoing {
  text: string;
  buttons?: { id: string; label: string }[];
  /** Показать кнопку «Отправить номер телефона» */
  requestContact?: boolean;
  /** Убрать клавиатуру с кнопкой номера */
  removeKeyboard?: boolean;
}

/** Отправка сообщения пользователю в его мессенджере (подключают telegram.ts и max.ts) */
export const senders: Partial<Record<Channel, (userId: string, out: Outgoing) => Promise<void>>> = {};

/** Хук уведомления модератора (подключает telegram.ts) */
export let notifyModeration: (q: Quote, company: string) => void = () => {};
export function setModerationNotifier(fn: typeof notifyModeration) {
  notifyModeration = fn;
}

const sessions = new Map<string, Pending>();
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");
const INVITE_RE = /^[A-Z0-9]{8}$/i;

function linkByInvite(msg: Incoming, code: string): Outgoing[] | null {
  const company = companies.byInvite(code.trim());
  if (!company) return null;
  members.link(msg.channel, msg.userId, company.id, msg.userName);
  return [{ text: `Предприятие «${company.name}» (${REGION_BY_ID[company.regionId].name}) подключено.\n\n${GREETING}` }];
}

export function handle(msg: Incoming): Outgoing[] {
  const key = `${msg.channel}:${msg.userId}`;

  if (msg.startPayload) {
    const linked = linkByInvite(msg, msg.startPayload);
    if (linked) return linked;
  }

  const member = members.get(msg.channel, msg.userId);
  if (!member) {
    if (msg.text && INVITE_RE.test(msg.text.trim())) {
      const linked = linkByInvite(msg, msg.text);
      if (linked) return linked;
    }
    // Не подтверждён — только анкета на подключение, цены не принимаем
    return handleGuest(msg);
  }

  const company = companies.get(member.companyId);
  if (!company || !company.active) return [{ text: "Предприятие отключено. Свяжитесь с менеджером АгроСферы." }];

  const now = Date.now();
  const today = mskDay(now);
  const todayQuotes = quotes.ofDay(today);
  const latest = latestAccepted(todayQuotes);
  const mine = latest.get(company.id);
  const ref = referenceInfo(latest, company.regionId, company.id);
  const previous = mine?.price ?? quotes.lastAcceptedBefore(company.id, today)?.price;
  const ctx = {
    regionName: REGION_BY_ID[company.regionId].name,
    reference: ref?.price,
    referenceScope: ref?.scope,
    previous,
  };

  const text = msg.text?.trim() ?? "";
  // Кнопки анкеты у уже подтверждённого пользователя не нужны
  if (msg.button && !msg.button.startsWith("b:")) return [{ text: GREETING }];
  const dialogButton = msg.button ? (msg.button.slice(2) as ButtonId) : undefined;
  if (!msg.button) {
    if (/^\/?(start|старт)$/i.test(text)) return [{ text: GREETING }];
    if (/^\/?(help|помощь)$/i.test(text)) return [{ text: HELP }];
    if (/^\/?(status|статус)$/i.test(text)) {
      return [{
        text: mine
          ? `Ваша цена сегодня: ${rub(mine.price)} ₽/т · ${rub(mine.volume)} т (обновлено ${new Date(mine.at).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" })}).`
          : "Сегодня вы ещё не присылали цену.",
      }];
    }
  }

  const reply = dialogButton ? replyToButton(dialogButton, sessions.get(key), ctx) : replyToText(text, ctx);

  if (reply.pending) sessions.set(key, reply.pending);
  else sessions.delete(key);

  // Явная ошибка — фиксируем в ленте как «не принято» (в индекс не идёт)
  if (!msg.button && !reply.pending && !reply.accept) {
    const parsed = parseSubmission(text);
    if (parsed.ok && checkQuote(parsed.price, parsed.volume, ctx).level === "reject") {
      publishQuote(
        quotes.insert(
          {
            companyId: company.id,
            regionId: company.regionId,
            price: parsed.price,
            volume: parsed.volume,
            at: now,
            status: "rejected",
            revision: 0,
            note: "Отклонено проверкой бота",
          },
          msg.channel
        )
      );
    }
  }

  if (reply.accept) {
    const revision = todayQuotes.filter((q) => q.companyId === company.id && q.status === "accepted").length + 1;
    const q = quotes.insert(
      {
        companyId: company.id,
        regionId: company.regionId,
        price: reply.accept.price,
        volume: reply.accept.volume,
        at: now,
        status: reply.accept.moderation ? "moderation" : "accepted",
        revision,
        prevPrice: mine?.price,
        note: reply.accept.moderation ? "Отклонение от медианы — ручная проверка" : undefined,
      },
      msg.channel
    );
    publishQuote(q);
    if (reply.accept.moderation) notifyModeration(q, `${company.name} (${company.code})`);
  }

  return [{ text: reply.text, buttons: reply.buttons?.map((b) => ({ id: `b:${b.id}`, label: b.label })) }];
}

/** Решение модератора по цене */
export function moderate(quoteId: string, approve: boolean): Quote | undefined {
  const q = quotes.get(quoteId);
  if (!q || q.status !== "moderation") return q;
  quotes.setStatus(quoteId, approve ? "accepted" : "rejected", approve ? undefined : "Отклонено модератором");
  const updated = quotes.get(quoteId)!;
  publishQuote(updated);
  return updated;
}
