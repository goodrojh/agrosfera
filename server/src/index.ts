import { config, mskDay, mskHour } from "./config.ts";
import { companies, members, quotes, reminders } from "./db.ts";
import { startApi } from "./api.ts";
import { sendTelegram, startTelegram } from "./telegram.ts";
import { sendMax, startMax } from "./max.ts";

startApi();

if (config.telegramToken) startTelegram();
else console.log("Telegram: TELEGRAM_BOT_TOKEN не задан — бот не запущен");

if (config.maxToken) startMax();
else console.log("MAX: MAX_BOT_TOKEN не задан — бот не запущен");

// Утреннее напоминание тем, кто ещё не прислал цену (пн–сб)
setInterval(() => {
  const now = Date.now();
  const weekday = new Date(now).getUTCDay();
  if (weekday === 0 || mskHour(now) !== config.reminderHour) return;
  const day = mskDay(now);
  const submitted = new Set(quotes.ofDay(day).filter((q) => q.status === "accepted").map((q) => q.companyId));
  for (const c of companies.list()) {
    if (!c.active || submitted.has(c.id) || !reminders.claim(day, c.id)) continue;
    for (const m of members.ofCompany(c.id)) {
      const text = "Доброе утро! Пришлите, пожалуйста, цену и свободный объём масличного льна на сегодня.\nФормат: ЦЕНА ОБЪЁМ, например 31500 200";
      void (m.channel === "telegram" ? sendTelegram(m.userId, text) : sendMax(m.userId, text));
    }
  }
}, 60_000);
