// Справочник регионов-производителей и экспортных направлений.
// Используется и сайтом, и ботом (server/), поэтому только относительные импорты.

export type DirectionId = "china" | "central_asia" | "caspian" | "black_sea";

export type RegionId =
  | "altai"
  | "novosibirsk"
  | "omsk"
  | "krasnoyarsk"
  | "amur"
  | "zabaikal"
  | "kurgan"
  | "chelyabinsk"
  | "bashkortostan"
  | "orenburg"
  | "saratov"
  | "samara"
  | "volgograd"
  | "rostov"
  | "krasnodar"
  | "stavropol";

export type MacroRegion = "Сибирь" | "Дальний Восток" | "Урал" | "Поволжье" | "Юг";

export interface Region {
  id: RegionId;
  name: string;
  macro: MacroRegion;
  /** Ориентир цены для демо-данных и первичной проверки, ₽/т с НДС, EXW */
  basePrice: number;
  directions: DirectionId[];
  /** Часовой пояс: бот пишет предприятиям в 8:00 по местному времени */
  tz: string;
}

export interface Direction {
  id: DirectionId;
  name: string;
  hubs: string;
  transport: string;
  note: string;
}

export const DIRECTIONS: Direction[] = [
  {
    id: "china",
    name: "Китай",
    hubs: "Забайкальск · Благовещенск · Наушки",
    transport: "ж/д, погранпереходы",
    note: "Сибирь и Дальний Восток — самое короткое плечо до границы с Китаем.",
  },
  {
    id: "central_asia",
    name: "Казахстан и Ср. Азия",
    hubs: "Петропавловск · Илецк · Достык (транзит в КНР)",
    transport: "ж/д",
    note: "Урал и Западная Сибирь: ж/д через Казахстан, в т.ч. транзитом в Китай.",
  },
  {
    id: "caspian",
    name: "Каспий",
    hubs: "Астрахань · Оля · Махачкала",
    transport: "ж/д + море",
    note: "Поволжье — выход на Иран и страны Каспийского региона.",
  },
  {
    id: "black_sea",
    name: "Чёрное море",
    hubs: "Новороссийск · Азов · Ростов-на-Дону · Тамань",
    transport: "авто/ж/д + море",
    note: "Юг и Нижнее Поволжье — Турция, Ближний Восток, ЕС.",
  },
];

export const REGIONS: Region[] = [
  { id: "altai", name: "Алтайский край", macro: "Сибирь", basePrice: 29800, directions: ["china"], tz: "Asia/Barnaul" },
  { id: "novosibirsk", name: "Новосибирская обл.", macro: "Сибирь", basePrice: 30100, directions: ["china"], tz: "Asia/Novosibirsk" },
  { id: "omsk", name: "Омская обл.", macro: "Сибирь", basePrice: 30400, directions: ["china", "central_asia"], tz: "Asia/Omsk" },
  { id: "krasnoyarsk", name: "Красноярский край", macro: "Сибирь", basePrice: 29500, directions: ["china"], tz: "Asia/Krasnoyarsk" },
  { id: "amur", name: "Амурская обл.", macro: "Дальний Восток", basePrice: 31900, directions: ["china"], tz: "Asia/Yakutsk" },
  { id: "zabaikal", name: "Забайкальский край", macro: "Дальний Восток", basePrice: 31500, directions: ["china"], tz: "Asia/Chita" },
  { id: "kurgan", name: "Курганская обл.", macro: "Урал", basePrice: 30700, directions: ["central_asia"], tz: "Asia/Yekaterinburg" },
  { id: "chelyabinsk", name: "Челябинская обл.", macro: "Урал", basePrice: 31100, directions: ["central_asia"], tz: "Asia/Yekaterinburg" },
  { id: "bashkortostan", name: "Респ. Башкортостан", macro: "Урал", basePrice: 31300, directions: ["central_asia"], tz: "Asia/Yekaterinburg" },
  { id: "orenburg", name: "Оренбургская обл.", macro: "Урал", basePrice: 31700, directions: ["central_asia", "caspian"], tz: "Asia/Yekaterinburg" },
  { id: "saratov", name: "Саратовская обл.", macro: "Поволжье", basePrice: 32600, directions: ["caspian"], tz: "Europe/Saratov" },
  { id: "samara", name: "Самарская обл.", macro: "Поволжье", basePrice: 32300, directions: ["caspian"], tz: "Europe/Samara" },
  { id: "volgograd", name: "Волгоградская обл.", macro: "Поволжье", basePrice: 33200, directions: ["caspian", "black_sea"], tz: "Europe/Volgograd" },
  { id: "rostov", name: "Ростовская обл.", macro: "Юг", basePrice: 34600, directions: ["black_sea"], tz: "Europe/Moscow" },
  { id: "krasnodar", name: "Краснодарский край", macro: "Юг", basePrice: 35000, directions: ["black_sea"], tz: "Europe/Moscow" },
  { id: "stavropol", name: "Ставропольский край", macro: "Юг", basePrice: 34200, directions: ["black_sea"], tz: "Europe/Moscow" },
];

export const REGION_BY_ID: Record<RegionId, Region> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r])
) as Record<RegionId, Region>;

export const DIRECTION_BY_ID: Record<DirectionId, Direction> = Object.fromEntries(
  DIRECTIONS.map((d) => [d.id, d])
) as Record<DirectionId, Direction>;

export function isRegionId(v: string): v is RegionId {
  return v in REGION_BY_ID;
}

/** Названия регионов в данных карты (lib/market/russia-map.json) */
export const MAP_NAME: Record<RegionId, string> = {
  altai: "Алтайский край",
  novosibirsk: "Новосибирская область",
  omsk: "Омская область",
  krasnoyarsk: "Красноярский край",
  amur: "Амурская область",
  zabaikal: "Забайкальский край",
  kurgan: "Курганская область",
  chelyabinsk: "Челябинская область",
  bashkortostan: "Башкортостан",
  orenburg: "Оренбургская область",
  saratov: "Саратовская область",
  samara: "Самарская область",
  volgograd: "Волгоградская область",
  rostov: "Ростовская область",
  krasnodar: "Краснодарский край",
  stavropol: "Ставропольский край",
};

/** Короткое имя для плотных списков: «Омская», «Алтайский», «Башкортостан» */
export function shortRegionName(id: RegionId): string {
  return REGION_BY_ID[id].name.replace(/^Респ\.\s*/, "").replace(/\s+(обл\.|край)$/, "");
}

/** Местные дата и время в часовом поясе региона */
export function localClock(ms: number, tz: string): { day: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24, minute: Number(get("minute")) };
}

/** Момент, когда в регионе было hour:00 сегодня (по местному времени) */
export function localSince(ms: number, tz: string, hour: number): number {
  const c = localClock(ms, tz);
  return ms - ((c.hour - hour) * 60 + c.minute) * 60_000 - (ms % 60_000);
}
