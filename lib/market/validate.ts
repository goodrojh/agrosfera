// Разбор сообщения от предприятия и защита от ошибочных цен.
// Один и тот же код работает в боте (server/) и в симуляторе на сайте.

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

export type ParseResult =
  | { ok: true; price: number; volume: number }
  | { ok: false; reason: "empty" | "no_numbers" | "one_number" | "too_many"; numbers?: number[] };

// \b в JS не работает с кириллицей, поэтому границу слова задаём через (?![а-яa-z])
const NB = "(?![а-яa-z])";
const THOUSAND_SUFFIX = new RegExp(String.raw`^\s*(тыс\.?|тысяч[а-я]*|т\.р\.?|тр${NB}|к${NB}|k${NB})`);

function toNumber(raw: string): number {
  return Number(raw.replace(/[\s  ]/g, "").replace(",", "."));
}

/** Число вида «32 500», «32500», «32,5», «32.5 тыс» */
const NUM = /(\d{1,3}(?:[   ]\d{3})+(?![\d.,])|\d+(?:[.,]\d+)?)/g;

function readNumber(text: string, match: RegExpExecArray): number {
  let value = toNumber(match[1]);
  const tail = text.slice(match.index + match[0].length);
  if (THOUSAND_SUFFIX.test(tail)) value *= 1000;
  return value;
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[  ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Цена и объём по ключевым словам: «цена 32500, объем 150», «32 500 руб 150 т» */
function parseLabeled(text: string): { price?: number; volume?: number } {
  const out: { price?: number; volume?: number } = {};
  const priceAfter = new RegExp(String.raw`(?:цена|стоимость|price)\s*[:=-]?\s*(\d[\d .,]*?)(\s*(?:тыс\.?|к${NB}|k${NB}))?(?=\s*(?:руб|р|₽|,|;|$|\s[а-яa-z]))`).exec(text);
  const priceBefore = new RegExp(String.raw`(\d[\d .,]*?)\s*(тыс\.?\s*)?(?:руб|р\.|р${NB}|₽|rub)`).exec(text);
  const volAfter = new RegExp(String.raw`(?:объем|кол-во|количество|volume)\s*[:=-]?\s*(\d[\d .,]*\d|\d)`).exec(text);
  const volBefore = new RegExp(String.raw`(\d[\d .,]*?)\s*(?:тонн[а-я]*|тн${NB}|т${NB}|t${NB})`).exec(text);

  const pm = priceAfter ?? priceBefore;
  if (pm) {
    let v = toNumber(pm[1].trim().replace(/[.,]$/, ""));
    if (pm[2]) v *= 1000;
    if (Number.isFinite(v)) out.price = v;
  }
  const vm = volAfter ?? volBefore;
  if (vm) {
    const v = toNumber(vm[1].trim().replace(/[.,]$/, ""));
    if (Number.isFinite(v)) out.volume = v;
  }
  return out;
}

export function parseSubmission(input: string): ParseResult {
  const text = normalize(input);
  if (!text) return { ok: false, reason: "empty" };

  const labeled = parseLabeled(text);
  if (labeled.price !== undefined && labeled.volume !== undefined) {
    return { ok: true, price: labeled.price, volume: labeled.volume };
  }

  // Явные разделители: перенос строки, «;», «/», «|», запятая с пробелом
  const segments = input
    .split(/\n|;|\/|\||,\s/)
    .map((s) => normalize(s))
    .filter((s) => /\d/.test(s));
  if (segments.length === 2) {
    const nums = segments.map((s) => {
      const re = new RegExp(NUM.source);
      const m = re.exec(s);
      return m ? readNumber(s, m) : NaN;
    });
    if (nums.every(Number.isFinite)) return { ok: true, price: nums[0], volume: nums[1] };
  }

  // Числа через пробел. Группы по 3 цифры трактуем как разряды: «32 500 150»
  const groups = text.replace(/[^\d\s.,]/g, " ").trim().split(/\s+/).filter((g) => /\d/.test(g));
  const withSuffix: number[] = [];
  const re = new RegExp(NUM.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) withSuffix.push(readNumber(text, m));

  if (groups.length === 0) return { ok: false, reason: "no_numbers" };
  if (groups.length === 1) return { ok: false, reason: "one_number", numbers: [toNumber(groups[0])] };
  if (groups.length === 2) {
    // «32,5 тыс 150» — учитываем суффикс «тыс»
    const nums = withSuffix.length === 2 ? withSuffix : groups.map(toNumber);
    return { ok: true, price: nums[0], volume: nums[1] };
  }
  const isTriplet = (g: string) => /^\d{3}$/.test(g);
  const isHead = (g: string) => /^\d{1,3}$/.test(g);
  if (groups.length === 3) {
    const [a, b, c] = groups;
    if (isHead(a) && isTriplet(b)) return { ok: true, price: toNumber(a + b), volume: toNumber(c) };
    if (isHead(b) && isTriplet(c)) return { ok: true, price: toNumber(a), volume: toNumber(b + c) };
  }
  if (groups.length === 4) {
    const [a, b, c, d] = groups;
    if (isHead(a) && isTriplet(b) && isHead(c) && isTriplet(d)) {
      return { ok: true, price: toNumber(a + b), volume: toNumber(c + d) };
    }
  }
  return { ok: false, reason: "too_many", numbers: groups.map(toNumber) };
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

/** Проверка заявки покупателя с сайта: те же пороги, но ответ — одна понятная ошибка */
export function checkBid(price: number, volume: number, reference?: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return "Укажите цену за тонну.";
  if (price < 1000 && price * 1000 >= LIMITS.priceMin) return `Похоже, цена в тысячах. Имели в виду ${rub(price * 1000)} ₽/т?`;
  if (price < LIMITS.priceMin || price > LIMITS.priceMax) return `Цена должна быть от ${rub(LIMITS.priceMin)} до ${rub(LIMITS.priceMax)} ₽/т.`;
  if (!Number.isFinite(volume) || volume < LIMITS.volumeMin || volume > LIMITS.volumeMax) {
    return `Объём должен быть от ${LIMITS.volumeMin} до ${rub(LIMITS.volumeMax)} т.`;
  }
  if (reference && Math.abs(price / reference - 1) > LIMITS.hard) {
    return `Цена сильно отличается от рынка (средняя ${rub(reference)} ₽/т). Проверьте цифру.`;
  }
  return null;
}
