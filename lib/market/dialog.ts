// Диалог бота: одинаковые ответы в Telegram, MAX и симуляторе на сайте.

import { checkQuote, parseSubmission, type CheckContext } from "./validate";

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

export interface Pending {
  price: number;
  volume: number;
  moderation: boolean;
  /** Цена исправлена по подсказке — перед приёмом проверить ещё раз */
  recheck: boolean;
}

export type ButtonId = "confirm" | "retry";

export interface BotReply {
  text: string;
  buttons?: { id: ButtonId; label: string }[];
  /** Ждём подтверждения этой подачи */
  pending?: Pending;
  /** Подачу нужно записать */
  accept?: { price: number; volume: number; moderation: boolean };
}

export interface DialogContext extends CheckContext {
  regionName: string;
  /** Откуда опорная цена: медиана региона или всего рынка */
  referenceScope?: "region" | "market";
}

export const GREETING =
  "Доброе утро! Пришлите цену за тонну масличного льна (с НДС, EXW) и свободный объём одним сообщением.\n\nФормат: ЦЕНА ОБЪЁМ\nНапример: 31500 200";

export const HELP =
  "Формат: ЦЕНА ОБЪЁМ — например, 31500 200.\nЦена — ₽ за тонну с НДС на складе предприятия, объём — сколько тонн готовы отгрузить.\nЦена изменилась — просто пришлите новое сообщение, котировка обновится.";

function acceptText(price: number, volume: number, ctx: DialogContext): string {
  return (
    `✅ Принято: ${rub(price)} ₽/т · ${rub(volume)} т (${ctx.regionName}).` +
    (ctx.reference
      ? `\nМедиана ${ctx.referenceScope === "region" ? "по региону" : "по рынку"} сейчас: ${rub(ctx.reference)} ₽/т.`
      : "") +
    "\nЦена изменится — пришлите новую, мы обновим."
  );
}

function evaluate(price: number, volume: number, ctx: DialogContext, recheck: boolean): BotReply {
  const check = checkQuote(price, volume, ctx);

  if (check.level === "reject") {
    return { text: "⛔ " + check.issues.map((i) => i.message).join("\n") + "\n\nОтправьте, пожалуйста, ещё раз: ЦЕНА ОБЪЁМ." };
  }

  if (check.level === "confirm") {
    const suggested = check.suggestion;
    const lines = check.issues.map((i) => "• " + i.message).join("\n");
    return {
      text: `Проверьте, пожалуйста:\n${lines}\n\nЦена: ${rub(suggested ?? price)} ₽/т\nОбъём: ${rub(volume)} т`,
      buttons: [
        { id: "confirm", label: suggested ? `✅ Да, ${rub(suggested)} ₽/т` : "✅ Подтверждаю" },
        { id: "retry", label: "✏️ Ввести заново" },
      ],
      pending: {
        price: suggested ?? price,
        volume,
        moderation: check.moderation,
        recheck: suggested !== undefined || recheck,
      },
    };
  }

  return { text: acceptText(price, volume, ctx), accept: { price, volume, moderation: false } };
}

export function replyToText(input: string, ctx: DialogContext): BotReply {
  const trimmed = input.trim();
  if (/^\/?(start|старт)$/i.test(trimmed)) return { text: GREETING };
  if (/^\/?(help|помощь)$/i.test(trimmed)) return { text: HELP };

  const parsed = parseSubmission(trimmed);
  if (!parsed.ok) {
    if (parsed.reason === "one_number") {
      return { text: `Вижу одно число — ${rub(parsed.numbers![0])}. Нужны два: цена за тонну и объём.\nНапример: 31500 200` };
    }
    if (parsed.reason === "too_many") return { text: "Не понял формат. Пришлите: ЦЕНА ОБЪЁМ, например 31500 200" };
    return { text: HELP };
  }
  return evaluate(parsed.price, parsed.volume, ctx, false);
}

export function replyToButton(id: ButtonId, pending: Pending | undefined, ctx: DialogContext): BotReply {
  if (id === "retry" || !pending) return { text: "Хорошо, пришлите цену и объём ещё раз: ЦЕНА ОБЪЁМ" };

  if (pending.recheck) {
    // Цену поправили по подсказке — проверяем уже исправленное значение
    const again = checkQuote(pending.price, pending.volume, ctx);
    const rest = again.issues.filter((i) => i.code !== "thousands" && i.code !== "extra_zero");
    if (rest.length > 0 && again.level !== "ok") {
      return evaluate(pending.price, pending.volume, ctx, false);
    }
  }

  if (pending.moderation) {
    return {
      text: `📝 Принято на проверку: ${rub(pending.price)} ₽/т · ${rub(pending.volume)} т.\nЦена заметно отличается от рынка — модератор сверит её и после этого добавит в котировку.`,
      accept: { price: pending.price, volume: pending.volume, moderation: true },
    };
  }
  return { text: acceptText(pending.price, pending.volume, ctx), accept: { price: pending.price, volume: pending.volume, moderation: false } };
}
