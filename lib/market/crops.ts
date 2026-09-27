// Культуры и показатели качества. Бот спрашивает цены по культурам, закреплённым за предприятием в панели управления.

import { REGIONS, type RegionId } from "./regions";

export type CropId = "flax" | "sunflower" | "rapeseed" | "soy" | "mustard" | "wheat" | "barley" | "chickpea";

/** Третий показатель качества: масличность — у масличных, протеин — у зерновых и сои */
export interface QualitySpec {
  label: string;
  /** Для подписей в таблице */
  short: string;
  min: number;
  max: number;
  /** Типичное значение — для примера в боте */
  typical: number;
}

/** Показатели, которые предприятие присылает по любой культуре, % */
export const MOISTURE = { label: "Влажность", short: "Влажн.", min: 1, max: 25, typical: 8 } as const;
export const IMPURITY = { label: "Сорная примесь", short: "Сорн.", min: 0, max: 20, typical: 1.5 } as const;

const OIL = (min: number, max: number, typical: number): QualitySpec => ({ label: "Масличность", short: "Масл.", min, max, typical });
const PROTEIN = (min: number, max: number, typical: number): QualitySpec => ({ label: "Протеин", short: "Протеин", min, max, typical });

export interface Crop {
  id: CropId;
  name: string;
  /** Масличность или протеин; у нута третьего показателя нет */
  quality: QualitySpec | null;
  /** Средняя цена по России для демо, ₽/т с НДС */
  basePrice: number;
  regions: RegionId[];
  /** Принимает ли бот цены на эту культуру */
  live: boolean;
}

const ALL = REGIONS.map((r) => r.id);

export const CROPS: Crop[] = [
  { id: "flax", name: "Лён масличный", quality: OIL(30, 55, 46), basePrice: 31700, regions: ALL, live: true },
  {
    id: "sunflower",
    name: "Подсолнечник",
    quality: OIL(30, 60, 48),
    basePrice: 38500,
    regions: ["saratov", "samara", "volgograd", "rostov", "krasnodar", "stavropol", "orenburg", "bashkortostan", "altai", "novosibirsk"],
    live: false,
  },
  {
    id: "rapeseed",
    name: "Рапс",
    quality: OIL(30, 55, 43),
    basePrice: 40500,
    regions: ["altai", "novosibirsk", "omsk", "krasnoyarsk", "kurgan", "chelyabinsk", "bashkortostan", "zabaikal", "krasnodar"],
    live: false,
  },
  { id: "soy", name: "Соя", quality: PROTEIN(25, 50, 36), basePrice: 39000, regions: ["amur", "krasnodar", "stavropol", "altai", "novosibirsk", "omsk"], live: false },
  { id: "mustard", name: "Горчица", quality: OIL(20, 50, 35), basePrice: 36000, regions: ["saratov", "volgograd", "orenburg", "rostov", "altai"], live: false },
  { id: "wheat", name: "Пшеница", quality: PROTEIN(7, 20, 12.5), basePrice: 15800, regions: ALL, live: false },
  {
    id: "barley",
    name: "Ячмень",
    quality: PROTEIN(7, 18, 11),
    basePrice: 13900,
    regions: ["altai", "novosibirsk", "omsk", "krasnoyarsk", "kurgan", "chelyabinsk", "bashkortostan", "orenburg", "saratov", "samara", "rostov", "krasnodar"],
    live: false,
  },
  { id: "chickpea", name: "Нут", quality: null, basePrice: 34500, regions: ["saratov", "volgograd", "samara", "orenburg", "rostov", "stavropol", "altai"], live: false },
];

export const CROP_BY_ID: Record<CropId, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<CropId, Crop>;
