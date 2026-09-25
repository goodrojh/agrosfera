import { config, mskDay, mskHour } from "./config.ts";
import { companies, members, reminders } from "./db.ts";
import { startApi } from "./api.ts";
import { startTelegram } from "./telegram.ts";
import { startMax } from "./max.ts";
import { beginRound, senders } from "./core.ts";

startApi();

if (config.telegramToken) startTelegram();
else console.log("Telegram: TELEGRAM_BOT_TOKEN не задан — бот не запущен");

if (config.maxToken) startMax();
else console.log("MAX: MAX_BOT_TOKEN не задан — бот не запущен");

if (!config.adminPassword) console.log("Панель управления: задайте ADMIN_PASSWORD в .env, чтобы войти");

// Утренний запрос цен (пн–сб): каждому участнику с открытым доступом — по закреплённым культурам
setInterval(async () => {
  const now = Date.now();
  const weekday = new Date(now).getUTCDay();
  if (weekday === 0 || mskHour(now) !== config.reminderHour) return;
  const day = mskDay(now);
  for (const c of companies.list()) {
    if (!c.active || !c.crops.length || !reminders.claim(day, c.id)) continue;
    for (const m of members.ofCompany(c.id)) {
      for (const out of beginRound(m.channel, m.userId, c)) await senders[m.channel]?.(m.userId, out);
    }
  }
}, 60_000);
