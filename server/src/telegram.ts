// Бот в Telegram (grammY, long polling).

import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.ts";
import { handle, moderate, setModerationNotifier, type Outgoing } from "./core.ts";
import { setLeadNotifier } from "./api.ts";
import type { ButtonId } from "../../lib/market/dialog.ts";

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

function keyboard(out: Outgoing) {
  if (!out.buttons?.length) return undefined;
  const kb = new InlineKeyboard();
  for (const b of out.buttons) kb.text(b.label, `b:${b.id}`);
  return kb;
}

export let sendTelegram: (userId: string, text: string) => Promise<void> = async () => {};

export function startTelegram() {
  const bot = new Bot(config.telegramToken);
  const userName = (from?: { first_name?: string; last_name?: string; username?: string }) =>
    [from?.first_name, from?.last_name].filter(Boolean).join(" ") || from?.username;

  bot.command("start", async (ctx) => {
    const out = handle({ channel: "telegram", userId: String(ctx.from?.id), userName: userName(ctx.from), text: "/start", startPayload: ctx.match || undefined });
    await ctx.reply(out.text, { reply_markup: keyboard(out) });
  });

  bot.on("message:text", async (ctx) => {
    if (config.adminChatId && String(ctx.chat.id) === config.adminChatId) return;
    const out = handle({ channel: "telegram", userId: String(ctx.from.id), userName: userName(ctx.from), text: ctx.message.text });
    await ctx.reply(out.text, { reply_markup: keyboard(out) });
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("mod:")) {
      if (!config.adminChatId || String(ctx.chat?.id) !== config.adminChatId) return ctx.answerCallbackQuery();
      const [, action, id] = data.split(":");
      const q = moderate(id, action === "ok");
      await ctx.answerCallbackQuery({ text: q ? (q.status === "accepted" ? "Принято в индекс" : "Отклонено") : "Не найдено" });
      await ctx.editMessageReplyMarkup().catch(() => {});
      if (q) await ctx.reply(`${q.status === "accepted" ? "✅ Принято" : "⛔ Отклонено"}: ${rub(q.price)} ₽/т`);
      return;
    }

    if (data.startsWith("b:")) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup().catch(() => {});
      const out = handle({ channel: "telegram", userId: String(ctx.from.id), userName: userName(ctx.from), button: data.slice(2) as ButtonId });
      await ctx.reply(out.text, { reply_markup: keyboard(out) });
    }
  });

  bot.catch((err) => console.error("Telegram:", err.error));

  sendTelegram = async (userId, text) => {
    await bot.api.sendMessage(userId, text).catch((e) => console.error("Telegram send:", e.message));
  };

  if (config.adminChatId) {
    setLeadNotifier((text) => void bot.api.sendMessage(config.adminChatId, text).catch((e) => console.error(e.message)));
    setModerationNotifier((q, company) => {
      const kb = new InlineKeyboard().text("✅ В индекс", `mod:ok:${q.id}`).text("⛔ Отклонить", `mod:no:${q.id}`);
      void bot.api
        .sendMessage(config.adminChatId, `🔎 Цена на проверку\n${company}\n${rub(q.price)} ₽/т · ${rub(q.volume)} т`, { reply_markup: kb })
        .catch((e) => console.error(e.message));
    });
  }

  void bot.api.setMyCommands([
    { command: "start", description: "Как прислать цену" },
    { command: "status", description: "Моя цена сегодня" },
    { command: "help", description: "Формат сообщения" },
  ]);

  bot.start({ onStart: (me) => console.log(`Telegram: @${me.username}`) });
  return bot;
}
