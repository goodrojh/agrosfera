"use client";

// Формы обратной связи, которые открываются на любой странице — без перехода по ссылке.
// Кнопка шлёт событие, общий обработчик в макете (ActionHost) показывает нужное окно.

import { API_URL } from "./config";
import type { CropId } from "./market/crops";
import type { RegionId } from "./market/regions";

export const REQUEST_EVENT = "agr-request";
export const PARTNER_EVENT = "agr-partner";

/** Открыть общую заявку экспортёра «подберите объём» */
export const openRequest = () => window.dispatchEvent(new Event(REQUEST_EVENT));
/** Открыть анкету предприятия «Стать партнёром» */
export const openPartner = () => window.dispatchEvent(new Event(PARTNER_EVENT));

/** Заявка экспортёра: на предложение из сводки (offerId) или общий запрос */
export interface LeadInput {
  offerId?: string;
  crop: CropId;
  regions?: RegionId[];
  volume?: number;
  price?: number;
  name: string;
  company: string;
  phone: string;
  comment: string;
}

const pause = () => new Promise((r) => setTimeout(r, 400));

async function post(path: string, body: unknown, fallback: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? null : (data.error ?? fallback);
  } catch {
    return "Нет связи с сервером. Попробуйте ещё раз.";
  }
}

/** Отправить заявку менеджеру. Возвращает текст ошибки или null. В демо-режиме ничего не отправляет */
export async function sendLead(input: LeadInput): Promise<string | null> {
  if (input.name.trim().length < 2) return "Укажите имя.";
  if (input.phone.replace(/\D/g, "").length < 10) return "Укажите телефон для связи.";
  if (!API_URL) return pause().then(() => null);
  return post("/api/leads", input, "Не удалось отправить заявку");
}

/** Отправить анкету предприятия. В демо-режиме ничего не отправляет */
export async function sendApplication(data: Record<string, unknown>): Promise<string | null> {
  if (!API_URL) return pause().then(() => null);
  return post("/api/apply", data, "Не удалось отправить анкету");
}
