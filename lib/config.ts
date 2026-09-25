// Настройки сайта через переменные окружения (задаются при сборке).

/** Префикс пути для GitHub Pages (/agrosfera) */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Адрес сервера с ботом и API. Пока пусто — сайт работает на демо-данных. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** Ссылки на ботов. Пока пусто — кнопки ведут к симулятору бота на сайте. */
export const TELEGRAM_BOT_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "";
export const MAX_BOT_URL = process.env.NEXT_PUBLIC_MAX_BOT_URL ?? "";

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;
