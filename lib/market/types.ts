import type { RegionId } from "./regions";

/** Публичное (анонимизированное) представление предприятия */
export interface Company {
  id: string;
  /** Код вида «П-0412» — имя предприятия наружу не показываем */
  code: string;
  regionId: RegionId;
}

export type QuoteStatus = "accepted" | "moderation" | "rejected";

/** Одна подача цены из бота. Повторная подача за день — новая ревизия. */
export interface Quote {
  id: string;
  companyId: string;
  regionId: RegionId;
  /** ₽/т с НДС, EXW склад предприятия */
  price: number;
  /** Свободный к отгрузке объём, т */
  volume: number;
  /** Время подачи, ms */
  at: number;
  status: QuoteStatus;
  /** 1 — первая подача за день, 2+ — обновление */
  revision: number;
  /** Цена предыдущей ревизии (для ленты) */
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
  /** Все подачи за сегодня, включая отклонённые */
  today: Quote[];
  /** Дневные закрытия за прошлые дни */
  history: DailyClose[];
  serverTime: number;
}
