// Разбор сообщения от предприятия и защита от ошибочных цен.
// Один и тот же код работает в боте (server/) и в симуляторе на сайте.

import { IMPURITY as IMPURITY_RANGE, MOISTURE as MOISTURE_RANGE } from "./crops";

export const LIMITS = {
  /** Допустимый диапазон цены, ₽/т с НДС */
  priceMin: 10_000,
  priceMax: 100_000,
  /** Допустимый объём, т */
  volumeMin: 1,
  volumeMax: 30_000,
  /** Объём, при котором просим подтверждение */
  volumeConfirm: 5_000,
  /** Отклонение от медианы региона/рынка: переспросить */
  soft: 0.15,
  /** Отклонение, при котором цена уходит на ручную проверку и не попадает в индекс */
  hard: 0.35,
  /** Изменение собственной цены предприятия, при котором переспрашиваем */
  revisionJump: 0.12,
} as const;

// \b в JS не работает с кириллицей, поэтому границу слова задаём через (?![а-яa-z])
const NB = "(?![а-яa-z])";
const THOUSAND_SUFFIX = new RegExp(String.raw`^\s*(тыс\.?|тысяч[а-я]*|т\.р\.?|тр${NB}|к${NB}|k${NB})`);

/** Число: «31500», «1,5», «8.5». Запятая — десятичная, только если за ней 1–2 цифры: «31500,200» — это два числа */
const NUM = /\d+(?:[.,]\d{1,2}(?!\d))?/g;

export type OfferParse =
  | { ok: true; price: number; volume: number; moisture: number; impurity: number; quality?: number }
  | { ok: false; reason: "empty" | "no_numbers" | "missing" | "too_many"; numbers: number[] };

/** Сколько чисел в ответе: цена, объём, влажность, сорная примесь и (если есть у культуры) масличность / протеин */
export const offerFields = (withQuality: boolean) => (withQuality ? 5 : 4);

/**
 * Ответ предприятия одной строкой: «31500 200 8 1.5 46».
 * Понимает «31 500» (разряды через пробел), «31,5 тыс», запятые и точки с запятой между числами.
 */
export function parseOffer(input: string, withQuality: boolean): OfferParse {
  const text = input.toLowerCase().replace(/ё/g, "е").replace(/[   ]/g, " ").trim();
  if (!text) return { ok: false, reason: "empty", numbers: [] };

  const tokens: { raw: string; value: number }[] = [];
  const re = new RegExp(NUM.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let value = Number(m[0].replace(",", "."));
    if (tokens.length === 0 && THOUSAND_SUFFIX.test(text.slice(m.index + m[0].length))) value *= 1000;
    tokens.push({ raw: m[0], value });
  }
  const expected = offerFields(withQuality);
  const isInt = (raw: string, len?: number) => /^\d+$/.test(raw) && (len === undefined || raw.length === len);

  // Лишнее число — вероятно, разряды через пробел: «31 500 …» или объём «1 200»
  for (const at of [0, 1]) {
    if (tokens.length !== expected + 1) break;
    const [a, b] = [tokens[at], tokens[at + 1]];
    if (a && b && isInt(a.raw) && a.raw.length <= 3 && isInt(b.raw, 3)) {
      tokens.splice(at, 2, { raw: a.raw + b.raw, value: Number(a.raw + b.raw) });
    }
  }

  const numbers = tokens.map((t) => t.value);
  if (!tokens.length) return { ok: false, reason: "no_numbers", numbers };
  if (tokens.length < expected) return { ok: false, reason: "missing", numbers };
  if (tokens.length > expected) return { ok: false, reason: "too_many", numbers };
  const [price, volume, moisture, impurity, quality] = numbers;
  return { ok: true, price, volume, moisture, impurity, ...(withQuality ? { quality } : {}) };
}

/** Проверка показателей качества. Возвращает текст ошибки или null */
export function checkQualityValues(
  v: { moisture: number; impurity: number; quality?: number },
  spec: { label: string; min: number; max: number } | null,
  order: string
): string | null {
  const out = (label: string, x: number, min: number, max: number) =>
    `${label} ${String(x).replace(".", ",")}% — вне диапазона ${min}–${max}%. Проверьте порядок чисел: ${order}.`;
  if (!(v.moisture >= MOISTURE_RANGE.min && v.moisture <= MOISTURE_RANGE.max)) return out("Влажность", v.moisture, MOISTURE_RANGE.min, MOISTURE_RANGE.max);
  if (!(v.impurity >= IMPURITY_RANGE.min && v.impurity <= IMPURITY_RANGE.max)) return out("Сорная примесь", v.impurity, IMPURITY_RANGE.min, IMPURITY_RANGE.max);
  if (spec && v.quality !== undefined && !(v.quality >= spec.min && v.quality <= spec.max)) return out(spec.label, v.quality, spec.min, spec.max);
  return null;
}

export type IssueCode =
  | "thousands"
  | "extra_zero"
  | "price_range"
  | "deviation_soft"
  | "deviation_hard"
  | "revision_jump"
  | "volume_range"
  | "volume_large";

export interface Issue {
  code: IssueCode;
  message: string;
}

export interface CheckResult {
  /** ok — принять сразу; confirm — переспросить; reject — не принимать */
  level: "ok" | "confirm" | "reject";
  issues: Issue[];
  /** Исправленная цена, которую предлагаем подтвердить одной кнопкой */
  suggestion?: number;
  /** Цена уходит на ручную проверку и до неё не участвует в индексе */
  moderation: boolean;
  reference?: number;
  deviation?: number;
}

export interface CheckContext {
  /** Медиана по региону (или по рынку, если по региону мало данных) */
  reference?: number;
  /** Предыдущая цена этого же предприятия за сегодня / вчера */
  previous?: number;
}

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

export function checkQuote(price: number, volume: number, ctx: CheckContext = {}): CheckResult {
  const issues: Issue[] = [];
  let level: CheckResult["level"] = "ok";
  let suggestion: number | undefined;
  let moderation = false;
  const raise = (l: CheckResult["level"]) => {
    const rank = { ok: 0, confirm: 1, reject: 2 };
    if (rank[l] > rank[level]) level = l;
  };
  const inRange = (p: number) => p >= LIMITS.priceMin && p <= LIMITS.priceMax;

  if (!Number.isFinite(volume) || volume < LIMITS.volumeMin || volume > LIMITS.volumeMax) {
    issues.push({
      code: "volume_range",
      message: `Объём ${Number.isFinite(volume) ? rub(volume) + " т" : ""} вне диапазона ${LIMITS.volumeMin}–${rub(LIMITS.volumeMax)} т.`,
    });
    raise("reject");
  } else if (volume > LIMITS.volumeConfirm) {
    issues.push({ code: "volume_large", message: `Большой объём: ${rub(volume)} т. Всё верно?` });
    raise("confirm");
  }

  if (!Number.isFinite(price) || price <= 0) {
    issues.push({ code: "price_range", message: "Не удалось распознать цену." });
    return { level: "reject", issues, moderation: false };
  }

  if (price < 1000) {
    const s = Math.round(price * 1000);
    if (inRange(s)) {
      suggestion = s;
      issues.push({
        code: "thousands",
        message: `Похоже, цена указана в тысячах: ${rub(price)} → ${rub(s)} ₽/т.`,
      });
      raise("confirm");
    } else {
      issues.push({ code: "price_range", message: `Цена ${rub(price)} ₽/т вне диапазона ${rub(LIMITS.priceMin)}–${rub(LIMITS.priceMax)} ₽/т.` });
      raise("reject");
    }
  } else if (price > LIMITS.priceMax) {
    const s = Math.round(price / 10);
    if (inRange(s)) {
      suggestion = s;
      issues.push({ code: "extra_zero", message: `Похоже, лишний ноль: ${rub(price)} → ${rub(s)} ₽/т.` });
      raise("confirm");
    } else {
      issues.push({ code: "price_range", message: `Цена ${rub(price)} ₽/т вне диапазона ${rub(LIMITS.priceMin)}–${rub(LIMITS.priceMax)} ₽/т.` });
      raise("reject");
    }
  } else if (price < LIMITS.priceMin) {
    issues.push({ code: "price_range", message: `Цена ${rub(price)} ₽/т вне диапазона ${rub(LIMITS.priceMin)}–${rub(LIMITS.priceMax)} ₽/т.` });
    raise("reject");
  }

  // Сравнение с рынком — только для цены в допустимом диапазоне
  let deviation: number | undefined;
  if (inRange(price) && ctx.reference && ctx.reference > 0) {
    deviation = price / ctx.reference - 1;
    const pct = Math.round(Math.abs(deviation) * 100);
    const side = deviation > 0 ? "выше" : "ниже";
    if (Math.abs(deviation) > LIMITS.hard) {
      moderation = true;
      issues.push({
        code: "deviation_hard",
        message: `Цена на ${pct}% ${side} медианы (${rub(ctx.reference)} ₽/т). После подтверждения её проверит модератор.`,
      });
      raise("confirm");
    } else if (Math.abs(deviation) > LIMITS.soft) {
      issues.push({
        code: "deviation_soft",
        message: `Цена на ${pct}% ${side} медианы (${rub(ctx.reference)} ₽/т). Подтвердите.`,
      });
      raise("confirm");
    }
  }

  if (inRange(price) && ctx.previous && ctx.previous > 0) {
    const jump = price / ctx.previous - 1;
    if (Math.abs(jump) > LIMITS.revisionJump) {
      issues.push({
        code: "revision_jump",
        message: `Ваша прошлая цена — ${rub(ctx.previous)} ₽/т, изменение ${jump > 0 ? "+" : "−"}${Math.round(Math.abs(jump) * 100)}%.`,
      });
      raise("confirm");
    }
  }

  return { level, issues, suggestion, moderation, reference: ctx.reference, deviation };
}
