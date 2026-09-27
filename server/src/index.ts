import { config } from "./config.ts";
import { companies, members, quotes, reminders } from "./db.ts";
import { startApi } from "./api.ts";
import { startTelegram } from "./telegram.ts";
import { startMax } from "./max.ts";
import { beginRound, senders } from "./core.ts";
import { localClock, localSince, REGION_BY_ID } from "../../lib/market/regions.ts";

startApi();

if (config.telegramToken) startTelegram();
else console.log("Telegram: TELEGRAM_BOT_TOKEN не задан — бот не запущен");

if (config.maxToken) startMax();
else console.log("MAX: MAX_BOT_TOKEN не задан — бот не запущен");

if (!config.adminPassword) console.log("Панель управления: задайте ADMIN_PASSWORD в .env, чтобы войти");

/** Утренний запрос — с 8:00 до 10:59, напоминание — с 11:00 до 13:59 по местному времени предприятия.
 *  Окно, а не одна минута: если сервер перезапускался, сообщение всё равно уйдёт, но только один раз за день. */
const MORNING = { from: 8, to: 11 };
const REMINDER = { from: 11, to: 14 };

async function tick() {
  const now = Date.now();
  for (const c of companies.list()) {
    if (c.role !== "producer" || !c.active || !c.crops.length) continue;
    const tz = REGION_BY_ID[c.regionId]?.tz ?? "Europe/Moscow";
    const { day, hour } = localClock(now, tz);
    let kind: "morning" | "reminder" | null = null;
    if (hour >= MORNING.from && hour < MORNING.to && reminders.claim(`${day}:am`, c.id)) kind = "morning";
    else if (
      hour >= REMINDER.from &&
      hour < REMINDER.to &&
      !quotes.answeredSince(c.id, localSince(now, tz, MORNING.from)) &&
      reminders.claim(`${day}:rem`, c.id)
    )
      kind = "reminder";
    if (!kind) continue;
    for (const m of members.ofCompany(c.id)) {
      for (const out of beginRound(m.channel, m.userId, c, kind)) await senders[m.channel]?.(m.userId, out);
    }
  }
}

setInterval(() => void tick().catch((e) => console.error("Рассылка:", e)), 60_000);
