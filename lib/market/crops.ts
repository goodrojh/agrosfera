// Культуры. Сейчас бот принимает цены на лён; остальные показаны на демо-данных,
// чтобы было видно, как инструмент работает для всего агросектора.

import { REGIONS, type RegionId } from "./regions";

export type CropId = "flax" | "sunflower" | "rapeseed" | "soy" | "mustard" | "wheat" | "barley" | "chickpea";

export interface Crop {
  id: CropId;
  name: string;
  /** Средняя цена по России для демо, ₽/т с НДС */
  basePrice: number;
  regions: RegionId[];
  /** Принимает ли бот цены на эту культуру */
  live: boolean;
}

const ALL = REGIONS.map((r) => r.id);

export const CROPS: Crop[] = [
  { id: "flax", name: "Лён масличный", basePrice: 31700, regions: ALL, live: true },
  {
    id: "sunflower",
    name: "Подсолнечник",
    basePrice: 38500,
    regions: ["saratov", "samara", "volgograd", "rostov", "krasnodar", "stavropol", "orenburg", "bashkortostan", "altai", "novosibirsk"],
    live: false,
  },
  {
    id: "rapeseed",
    name: "Рапс",
    basePrice: 40500,
    regions: ["altai", "novosibirsk", "omsk", "krasnoyarsk", "kurgan", "chelyabinsk", "bashkortostan", "zabaikal", "krasnodar"],
    live: false,
  },
  { id: "soy", name: "Соя", basePrice: 39000, regions: ["amur", "krasnodar", "stavropol", "altai", "novosibirsk", "omsk"], live: false },
  { id: "mustard", name: "Горчица", basePrice: 36000, regions: ["saratov", "volgograd", "orenburg", "rostov", "altai"], live: false },
  { id: "wheat", name: "Пшеница", basePrice: 15800, regions: ALL, live: false },
  {
    id: "barley",
    name: "Ячмень",
    basePrice: 13900,
    regions: ["altai", "novosibirsk", "omsk", "krasnoyarsk", "kurgan", "chelyabinsk", "bashkortostan", "orenburg", "saratov", "samara", "rostov", "krasnodar"],
    live: false,
  },
  { id: "chickpea", name: "Нут", basePrice: 34500, regions: ["saratov", "volgograd", "samara", "orenburg", "rostov", "stavropol", "altai"], live: false },
];

export const CROP_BY_ID: Record<CropId, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<CropId, Crop>;
