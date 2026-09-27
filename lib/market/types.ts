import type { RegionId } from "./regions";
import type { CropId } from "./crops";

/** Публичное (анонимизированное) представление предприятия */
export interface Company {
  id: string;
  /** Код вида «П-0412» — имя предприятия наружу не показываем */
  code: string;
  regionId: RegionId;
}

/** withdrawn — предприятие ответило «сегодня нет в продаже», предложение снимается со сводки */
export type QuoteStatus = "accepted" | "moderation" | "rejected" | "withdrawn";

/** Показатели качества партии, % */
export interface QualityValues {
  moisture?: number;
  impurity?: number;
  /** Масличность или протеин — в зависимости от культуры */
  quality?: number;
}

/** Ответ предприятия боту: цена, объём и качество. Повторный ответ — новая ревизия. */
export interface Quote extends QualityValues {
  id: string;
  /** Культура; у старых записей — лён */
  crop?: CropId;
  companyId: string;
  regionId: RegionId;
  /** ₽/т с НДС, самовывоз со склада предприятия */
  price: number;
  /** Свободный к отгрузке объём, т */
  volume: number;
  /** Время ответа, ms */
  at: number;
  status: QuoteStatus;
  /** 1 — первый ответ за день, 2+ — обновление */
  revision: number;
  prevPrice?: number;
  /** Причина исключения из расчёта */
  note?: string;
}

/** Последняя принятая цена предприятия за день */
export interface DailyClose {
  day: string; // YYYY-MM-DD
  companyId: string;
  regionId: RegionId;
  price: number;
  volume: number;
}

export interface MarketSnapshot {
  companies: Company[];
  /** Ответы предприятий за последние дни — из них складываются сводка и график за день */
  recent: Quote[];
  /** Дневные закрытия за прошлые дни */
  history: DailyClose[];
  serverTime: number;
}
