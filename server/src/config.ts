try {
  process.loadEnvFile();
} catch {
  // .env не обязателен — переменные могут прийти из окружения
}

const env = (k: string, d = "") => (process.env[k] ?? d).trim();

export const config = {
  port: Number(env("PORT", "8080")),
  dbPath: env("DB_PATH", "./data/agrosfera.db"),
  corsOrigin: env("CORS_ORIGIN", "*"),
  telegramToken: env("TELEGRAM_BOT_TOKEN"),
  telegramUsername: env("TELEGRAM_BOT_USERNAME"),
  adminChatId: env("ADMIN_CHAT_ID"),
  maxToken: env("MAX_BOT_TOKEN"),
  maxUsername: env("MAX_BOT_USERNAME"),
  reminderHour: Number(env("REMINDER_HOUR", "9")),
};

/** Рабочий день считаем по Москве */
export function mskDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(ms);
}

export function mskHour(ms: number): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hour12: false }).format(ms));
}
