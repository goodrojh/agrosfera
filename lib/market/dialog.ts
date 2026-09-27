// Диалог бота: одинаковые ответы в Telegram, MAX и симуляторе на сайте.
// Предприятие отвечает одной строкой: цена, объём, влажность, сорная примесь, масличность (протеин).

import { checkQualityValues, checkQuote, parseOffer, type CheckContext } from "./validate";
import { IMPURITY, MOISTURE, type QualitySpec } from "./crops";

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");
const pctText = (n: number) => `${String(n).replace(".", ",")}%`;

/** Цена, объём и качество партии */
export interface Offer {
  price: number;
  volume: number;
  moisture: number;
  impurity: number;
  quality?: number;
}

export interface Pending extends Offer {
  moderation: boolean;
  /** Цена исправлена по подсказке — перед приёмом проверить ещё раз */
  recheck: boolean;
}

export type ButtonId = "confirm" | "retry";

export interface BotReply {
  text: string;
  buttons?: { id: ButtonId; label: string }[];
  /** Ждём подтверждения этого ответа */
  pending?: Pending;
  /** Ответ нужно записать */
  accept?: Offer & { moderation: boolean };
}

export interface DialogContext extends CheckContext {
  regionName: string;
  /** Откуда опорная цена: медиана региона или всего рынка */
  referenceScope?: "region" | "market";
  /** Третий показатель культуры: масличность или протеин (у нута — нет) */
  quality: QualitySpec | null;
  basePrice: number;
}

/** Порядок чисел в ответе — для подсказок */
export function fieldOrder(q: QualitySpec | null): string {
  return ["цена", "объём", MOISTURE.label.toLowerCase(), IMPURITY.label.toLowerCase(), ...(q ? [q.label.toLowerCase()] : [])].join(", ");
}

/** Пример ответа: «31500 200 8 1.5 46» */
export function example(q: QualitySpec | null, basePrice: number): string {
  return [Math.round(basePrice / 500) * 500, 200, MOISTURE.typical, IMPURITY.typical, ...(q ? [q.typical] : [])].join(" ");
}

export function formatHint(q: QualitySpec | null, basePrice: number): string {
  return `Одной строкой: ${fieldOrder(q)}.\nНапример: ${example(q, basePrice)}`;
}

/** «31 500 ₽/т · 200 т · влажность 8% · сорная примесь 1,5% · масличность 46%» */
export function describe(o: Offer, q: QualitySpec | null): string {
  const parts = [`${rub(o.price)} ₽/т`, `${rub(o.volume)} т`, `влажность ${pctText(o.moisture)}`, `сорная примесь ${pctText(o.impurity)}`];
  if (q && o.quality !== undefined) parts.push(`${q.label.toLowerCase()} ${pctText(o.quality)}`);
  return parts.join(" · ");
}

function acceptText(o: Offer, ctx: DialogContext): string {
  return (
    `✅ Принято: ${describe(o, ctx.quality)} (${ctx.regionName}).` +
    (ctx.reference ? `\nМедиана ${ctx.referenceScope === "region" ? "по региону" : "по рынку"} сейчас: ${rub(ctx.reference)} ₽/т.` : "") +
    "\nИзменится — пришлите новую строку, мы обновим."
  );
}

function evaluate(o: Offer, ctx: DialogContext, recheck: boolean): BotReply {
  const qualityError = checkQualityValues(o, ctx.quality, fieldOrder(ctx.quality));
  if (qualityError) return { text: `⛔ ${qualityError}\n\n${formatHint(ctx.quality, ctx.basePrice)}` };

  const check = checkQuote(o.price, o.volume, ctx);
  if (check.level === "reject") {
    return { text: "⛔ " + check.issues.map((i) => i.message).join("\n") + `\n\n${formatHint(ctx.quality, ctx.basePrice)}` };
  }
  if (check.level === "confirm") {
    const fixed = { ...o, price: check.suggestion ?? o.price };
    return {
      text: `Проверьте, пожалуйста:\n${check.issues.map((i) => "• " + i.message).join("\n")}\n\n${describe(fixed, ctx.quality)}`,
      buttons: [
        { id: "confirm", label: check.suggestion ? `✅ Да, ${rub(check.suggestion)} ₽/т` : "✅ Подтверждаю" },
        { id: "retry", label: "✏️ Ввести заново" },
      ],
      pending: { ...fixed, moderation: check.moderation, recheck: check.suggestion !== undefined || recheck },
    };
  }
  return { text: acceptText(o, ctx), accept: { ...o, moderation: false } };
}

export function replyToText(input: string, ctx: DialogContext): BotReply {
  const parsed = parseOffer(input, !!ctx.quality);
  if (!parsed.ok) {
    const need = ctx.quality ? "5 чисел" : "4 числа";
    if (parsed.reason === "missing" && parsed.numbers.length === 2) {
      return { text: `Цену и объём вижу. Добавьте, пожалуйста, качество — ${fieldOrder(ctx.quality).split(", ").slice(2).join(", ")}.\nНапример: ${example(ctx.quality, ctx.basePrice)}` };
    }
    if (parsed.reason === "missing" || parsed.reason === "too_many") {
      return { text: `Нужно ${need} — ${fieldOrder(ctx.quality)}. Вижу ${parsed.numbers.length}.\nНапример: ${example(ctx.quality, ctx.basePrice)}` };
    }
    return { text: formatHint(ctx.quality, ctx.basePrice) };
  }
  return evaluate(parsed, ctx, false);
}

export function replyToButton(id: ButtonId, pending: Pending | undefined, ctx: DialogContext): BotReply {
  if (id === "retry" || !pending) return { text: `Хорошо, пришлите ещё раз. ${formatHint(ctx.quality, ctx.basePrice)}` };

  if (pending.recheck) {
    // Цену поправили по подсказке — проверяем уже исправленное значение
    const again = checkQuote(pending.price, pending.volume, ctx);
    const rest = again.issues.filter((i) => i.code !== "thousands" && i.code !== "extra_zero");
    if (rest.length > 0 && again.level !== "ok") return evaluate(pending, ctx, false);
  }

  const { moderation, recheck: _recheck, ...offer } = pending;
  void _recheck;
  if (moderation) {
    return {
      text: `📝 Принято на проверку: ${describe(offer, ctx.quality)}.\nЦена заметно отличается от рынка — менеджер сверит её и после этого опубликует.`,
      accept: { ...offer, moderation: true },
    };
  }
  return { text: acceptText(offer, ctx), accept: { ...offer, moderation: false } };
}
