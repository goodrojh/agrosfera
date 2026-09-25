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
  { id: "altai", name: "Алтайский край", macro: "Сибирь", basePrice: 29800, directions: ["china"] },
  { id: "novosibirsk", name: "Новосибирская обл.", macro: "Сибирь", basePrice: 30100, directions: ["china"] },
  { id: "omsk", name: "Омская обл.", macro: "Сибирь", basePrice: 30400, directions: ["china", "central_asia"] },
  { id: "krasnoyarsk", name: "Красноярский край", macro: "Сибирь", basePrice: 29500, directions: ["china"] },
  { id: "amur", name: "Амурская обл.", macro: "Дальний Восток", basePrice: 31900, directions: ["china"] },
  { id: "zabaikal", name: "Забайкальский край", macro: "Дальний Восток", basePrice: 31500, directions: ["china"] },
  { id: "kurgan", name: "Курганская обл.", macro: "Урал", basePrice: 30700, directions: ["central_asia"] },
  { id: "chelyabinsk", name: "Челябинская обл.", macro: "Урал", basePrice: 31100, directions: ["central_asia"] },
  { id: "bashkortostan", name: "Респ. Башкортостан", macro: "Урал", basePrice: 31300, directions: ["central_asia"] },
  { id: "orenburg", name: "Оренбургская обл.", macro: "Урал", basePrice: 31700, directions: ["central_asia", "caspian"] },
  { id: "saratov", name: "Саратовская обл.", macro: "Поволжье", basePrice: 32600, directions: ["caspian"] },
  { id: "samara", name: "Самарская обл.", macro: "Поволжье", basePrice: 32300, directions: ["caspian"] },
  { id: "volgograd", name: "Волгоградская обл.", macro: "Поволжье", basePrice: 33200, directions: ["caspian", "black_sea"] },
  { id: "rostov", name: "Ростовская обл.", macro: "Юг", basePrice: 34600, directions: ["black_sea"] },
  { id: "krasnodar", name: "Краснодарский край", macro: "Юг", basePrice: 35000, directions: ["black_sea"] },
  { id: "stavropol", name: "Ставропольский край", macro: "Юг", basePrice: 34200, directions: ["black_sea"] },
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
