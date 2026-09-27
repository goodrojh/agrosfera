// Логика бота, общая для Telegram и MAX.
// Каждое утро предприятие присылает одной строкой цену, объём и качество по каждой закреплённой культуре.
// Ответы принимаются только от предприятий с открытым доступом (галочка в панели управления).

import { EventEmitter } from "node:events";
import { config } from "./config.ts";
import { companies, members, quotes, type Channel, type CompanyRow } from "./db.ts";
import { activeOffers, OFFER_TTL, referenceInfo } from "../../lib/market/aggregate.ts";
import { describe, formatHint, replyToButton, replyToText, type ButtonId, type Pending } from "../../lib/market/dialog.ts";
import { REGION_BY_ID } from "../../lib/market/regions.ts";
import { CROPS, CROP_BY_ID, type CropId } from "../../lib/market/crops.ts";
import type { Company, Quote } from "../../lib/market/types.ts";

/** События для SSE-потока сайта */
export const bus = new EventEmitter();
bus.setMaxListeners(1000);

export function publishQuote(q: Quote) {
  bus.emit("quote", q);
}
export function publishCompany(c: Company) {
  bus.emit("company", c);
}

export interface Incoming {
  channel: Channel;
  userId: string;
  userName?: string;
  /** @username в мессенджере */
  userHandle?: string;
  text?: string;
  /** Нажатая кнопка: «b:confirm», «skip»… */
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

/** Уведомления в админ-чат Telegram (необязательно — всё решается в панели управления) */
export let notifyAdmin: (text: string) => void = () => {};
export function setAdminNotifier(fn: typeof notifyAdmin) {
  notifyAdmin = fn;
}

/** Опрос цен: очередь культур, по которым ждём ответ, и незавершённое подтверждение */
interface Round {
  queue: CropId[];
  pending?: Pending;
  accepted: string[];
}
const rounds = new Map<string, Round>();

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");
const INVITE_RE = /^[A-Z0-9]{8}$/i;
const SKIP_RE = /^(нет|не продаём|не продаем|нету|0|-|—|пропуск|пропустить)$/i;
const applyUrl = () => `${config.siteUrl}/sotrudnichestvo/#partner`;

const cropList = (crops: CropId[]) => crops.map((c) => CROP_BY_ID[c].name).join(", ");

function askCrop(crop: CropId, index: number, total: number): Outgoing {
  const c = CROP_BY_ID[crop];
  return {
    text: `${total > 1 ? `${index}/${total}. ` : ""}${c.name}\n${formatHint(c.quality, c.basePrice)}\n\nЦена — ₽ за тонну с НДС, самовывоз со склада; объём — тонн; показатели — в %.`,
    buttons: [{ id: "skip", label: "Сегодня нет в продаже" }],
  };
}

function guest(): Outgoing[] {
  return [
    {
      text:
        "Бот АгроСферы работает с предприятиями-партнёрами, которые прошли проверку.\n\n" +
        `Чтобы стать партнёром, заполните анкету на сайте: ${applyUrl()}\n\n` +
        "Если анкета одобрена — нажмите «Отправить номер», и мы найдём вашу карточку.",
      requestContact: true,
    },
  ];
}

function statusText(c: CompanyRow): string | null {
  if (c.status === "new") return "Ваша анкета на проверке. Менеджер свяжется с вами, после разговора откроем доступ — и бот начнёт присылать запросы цен.";
  if (c.status === "blocked") return "Доступ к боту закрыт. Свяжитесь с менеджером АгроСферы.";
  if (!c.crops.length) return "Доступ открыт, но за вами пока не закреплены культуры. Менеджер добавит их — и бот начнёт спрашивать цены.";
  return null;
}

const GREETING = {
  morning: (list: string) => `Доброе утро! Пришлите, пожалуйста, предложение на сегодня${list}.`,
  reminder: (list: string) => `Напоминаем: ждём ваше предложение на сегодня${list}. Без ответа предложение уйдёт из сводки через 3 дня.`,
};

/** Начать опрос по всем закреплённым культурам */
export function beginRound(channel: Channel, userId: string, company: CompanyRow, greeting: keyof typeof GREETING | false = "morning"): Outgoing[] {
  const queue = [...company.crops];
  if (!queue.length) return [{ text: statusText(company)! }];
  rounds.set(`${channel}:${userId}`, { queue, accepted: [] });
  const list = queue.length > 1 ? ` по культурам: ${cropList(queue)}` : "";
  const intro: Outgoing[] = greeting ? [{ text: GREETING[greeting](list) }] : [];
  return [...intro, askCrop(queue[0], 1, queue.length)];
}

function link(msg: Incoming, company: CompanyRow, via: string): Outgoing[] {
  members.link(msg.channel, msg.userId, company.id, msg.userName ?? msg.userHandle);
  notifyAdmin(`🔗 ${company.name} (${company.code}) подключился к боту: ${msg.userHandle ?? msg.userName ?? msg.userId} · ${via}`);
  const head: Outgoing = {
    text: `Здравствуйте! Предприятие ${company.name} подключено к АгроСфере.\nКультуры: ${cropList(company.crops) || "пока не закреплены"}.\n\nКаждое утро в 8:00 по вашему времени бот попросит цену, объём и качество. Изменилось что-то днём — просто пришлите новую строку.`,
    removeKeyboard: true,
  };
  return [head, ...beginRound(msg.channel, msg.userId, company, false)];
}

export function handle(msg: Incoming): Outgoing[] {
  const key = `${msg.channel}:${msg.userId}`;

  // Персональная ссылка-приглашение из панели управления
  if (msg.startPayload) {
    const company = companies.byInvite(msg.startPayload.trim());
    if (company) return company.active ? link(msg, company, "по ссылке-приглашению") : [{ text: statusText(company)! }];
  }

  let member = members.get(msg.channel, msg.userId);

  // Поиск карточки по номеру телефона из анкеты
  if (msg.phone) {
    const company = companies.byPhone(msg.phone);
    if (!company) {
      return [{ text: `Не нашли анкету с номером ${msg.phone}. Заполните анкету на сайте: ${applyUrl()}\nПосле разговора с менеджером доступ откроется.`, removeKeyboard: true }];
    }
    if (!company.active) return [{ text: statusText(company)!, removeKeyboard: true }];
    if (!member || member.companyId !== company.id) return link(msg, company, "по номеру телефона");
    member = members.get(msg.channel, msg.userId);
  }

  if (!member) {
    if (msg.text && INVITE_RE.test(msg.text.trim())) {
      const company = companies.byInvite(msg.text.trim());
      if (company) return company.active ? link(msg, company, "по коду приглашения") : [{ text: statusText(company)! }];
    }
    return guest();
  }

  const company = companies.get(member.companyId);
  if (!company) return guest();
  const closed = statusText(company);
  if (closed) return [{ text: closed }];

  const text = msg.text?.trim() ?? "";
  if (!msg.button) {
    if (/^\/?(start|старт)$/i.test(text) || /^\/?(price|цены|цена)$/i.test(text)) return beginRound(msg.channel, msg.userId, company, false);
    if (/^\/?(help|помощь)$/i.test(text)) {
      const lines = company.crops.map((c) => `• ${CROP_BY_ID[c].name}: ${formatHint(CROP_BY_ID[c].quality, CROP_BY_ID[c].basePrice).split("\n")[1]}`);
      return [{ text: `Бот спрашивает предложения по вашим культурам — одной строкой.\n${lines.join("\n")}\n«нет» — сегодня не продаёте.\n/price — прислать сейчас, /status — мои предложения.` }];
    }
    if (/^\/?(status|статус)$/i.test(text)) return [statusToday(company)];
  }

  let round = rounds.get(key);

  // Без активного опроса: «подсолнечник 38000 300» — по названию; одна культура — принимаем сразу; иначе начинаем опрос
  if (!round) {
    const named = CROPS.find((c) => company.crops.includes(c.id) && text.toLowerCase().startsWith(c.name.toLowerCase().split(" ")[0]));
    if (named) {
      round = { queue: [named.id], accepted: [] };
      rounds.set(key, round);
      return answer(msg, company, round, text.slice(named.name.split(" ")[0].length).trim());
    }
    if (company.crops.length === 1 && (msg.text || msg.button)) {
      round = { queue: [company.crops[0]], accepted: [] };
      rounds.set(key, round);
    } else {
      return beginRound(msg.channel, msg.userId, company, false);
    }
  }

  return answer(msg, company, round, text);
}

/** Ответ на вопрос о текущей культуре опроса */
function answer(msg: Incoming, company: CompanyRow, round: Round, text: string): Outgoing[] {
  const key = `${msg.channel}:${msg.userId}`;
  const crop = round.queue[0];
  const total = company.crops.length;

  const next = (): Outgoing[] => {
    round.queue.shift();
    round.pending = undefined;
    if (round.queue.length) return [askCrop(round.queue[0], total - round.queue.length + 1, total)];
    rounds.delete(key);
    return [
      {
        text: round.accepted.length
          ? `Спасибо! Опубликовали в сводке:\n${round.accepted.join("\n")}\n\nИзменится — пришлите /price.`
          : "Понял, сегодня без предложений. Появится объём — пришлите /price.",
      },
    ];
  };

  const now = Date.now();
  const offers = activeOffers(quotes.since(now - OFFER_TTL, crop), now);
  const mine = offers.find((q) => q.companyId === company.id);
  const revision = (mine?.revision ?? 0) + 1;

  // «Сегодня нет в продаже» — снимаем предложение со сводки
  if (msg.button === "skip" || (!msg.button && SKIP_RE.test(text))) {
    publishQuote(quotes.insert({ crop, companyId: company.id, regionId: company.regionId, price: 0, volume: 0, at: now, status: "withdrawn", revision }, msg.channel));
    return next();
  }

  const cropInfo = CROP_BY_ID[crop];
  const ref = referenceInfo(offers, company.regionId, company.id);
  const ctx = {
    regionName: REGION_BY_ID[company.regionId].name,
    reference: ref?.price,
    referenceScope: ref?.scope,
    previous: mine?.price,
    quality: cropInfo.quality,
    basePrice: cropInfo.basePrice,
  };

  const dialogButton = msg.button?.startsWith("b:") ? (msg.button.slice(2) as ButtonId) : undefined;
  const reply = dialogButton ? replyToButton(dialogButton, round.pending, ctx) : replyToText(text, ctx);
  round.pending = reply.pending;

  if (reply.accept) {
    const { moderation, ...offer } = reply.accept;
    const q = quotes.insert(
      {
        crop,
        companyId: company.id,
        regionId: company.regionId,
        ...offer,
        at: now,
        status: moderation ? "moderation" : "accepted",
        revision,
        prevPrice: mine?.price,
        note: moderation ? "Отклонение от медианы — ручная проверка" : undefined,
      },
      msg.channel
    );
    publishQuote(q);
    const line = `${cropInfo.name}: ${describe(offer, cropInfo.quality)}`;
    if (moderation) notifyAdmin(`🔎 Цена на проверку: ${company.name} · ${line}`);
    round.accepted.push(`• ${line}${moderation ? " (на проверке)" : ""}`);
    return [{ text: reply.text }, ...next()];
  }

  return [
    {
      text: reply.text,
      buttons: reply.buttons?.map((b) => ({ id: `b:${b.id}`, label: b.label })) ?? [{ id: "skip", label: "Сегодня нет в продаже" }],
    },
  ];
}

function statusToday(company: CompanyRow): Outgoing {
  const now = Date.now();
  const lines = company.crops.map((crop) => {
    const q = activeOffers(quotes.since(now - OFFER_TTL, crop), now).find((x) => x.companyId === company.id);
    return `• ${CROP_BY_ID[crop].name}: ${q ? describe({ ...q, moisture: q.moisture ?? 0, impurity: q.impurity ?? 0 }, CROP_BY_ID[crop].quality) : "нет в сводке"}`;
  });
  return { text: `Ваши предложения в сводке:\n${lines.join("\n")}` };
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
