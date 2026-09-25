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

export type BuyerType = "exporter" | "agent";

export const BUYER_LABEL: Record<BuyerType, string> = { exporter: "экспортёр", agent: "агент" };

/** Заявка покупателя в стакане. Контакты наружу не отдаются. */
export interface Bid {
  id: string;
  /** ₽/т с НДС, EXW */
  price: number;
  /** Сколько тонн хотят купить */
  volume: number;
  /** Из каких регионов готовы брать; пусто — из любых */
  regions: RegionId[];
  /** Кто покупает */
  buyer?: BuyerType;
  at: number;
  status: "active" | "removed";
  /** Заявка, оставленная в этом браузере */
  own?: boolean;
}

export interface MarketSnapshot {
  companies: Company[];
  /** Все подачи за сегодня, включая отклонённые */
  today: Quote[];
  /** Дневные закрытия за прошлые дни */
  history: DailyClose[];
  /** Активные заявки покупателей */
  bids: Bid[];
  serverTime: number;
}
