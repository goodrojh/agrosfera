// Бот в Telegram (grammY, long polling).
// Модерация — в панели управления (/admin). Здесь: подключение участника и опрос цен.

import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";
import { config } from "./config.ts";
import { handle, senders, setAdminNotifier, type Incoming, type Outgoing } from "./core.ts";

function markup(out: Outgoing) {
  if (out.requestContact) return new Keyboard().requestContact("📱 Отправить номер").resized().oneTime();
  if (out.removeKeyboard && !out.buttons?.length) return { remove_keyboard: true as const };
  if (!out.buttons?.length) return undefined;
  const kb = new InlineKeyboard();
  const perRow = out.buttons.length > 2 ? 2 : out.buttons.length;
  out.buttons.forEach((b, i) => {
    kb.text(b.label, b.id);
    if ((i + 1) % perRow === 0) kb.row();
  });
  return kb;
}

export let sendTelegram: (userId: string, text: string) => Promise<void> = async () => {};

export function startTelegram() {
  const bot = new Bot(config.telegramToken);

  const who = (ctx: Context): Pick<Incoming, "userId" | "userName" | "userHandle"> => ({
    userId: String(ctx.from?.id),
    userName: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || undefined,
    userHandle: ctx.from?.username ? `@${ctx.from.username}` : undefined,
  });
  const replyAll = async (ctx: Context, outs: Outgoing[]) => {
    for (const out of outs) await ctx.reply(out.text, { reply_markup: markup(out), link_preview_options: { is_disabled: true } });
  };

  // Узнать ID чата — чтобы получать уведомления об анкетах и заявках (ADMIN_CHAT_ID)
  bot.command("id", (ctx) => ctx.reply(`ID этого чата: ${ctx.chat.id}`));

  bot.command("start", async (ctx) => {
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), text: "/start", startPayload: ctx.match || undefined }));
  });

  bot.on("message:contact", async (ctx) => {
    // Принимаем только свой номер, а не пересланный чужой контакт
    if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
      return ctx.reply("Отправьте, пожалуйста, свой номер — кнопкой «Отправить номер».");
    }
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), phone: ctx.message.contact.phone_number }));
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), text: ctx.message.text }));
  });

  bot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup().catch(() => {});
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), button: ctx.callbackQuery.data }));
  });

  bot.catch((err) => console.error("Telegram:", err.error));

  senders.telegram = async (userId, out) => {
    await bot.api
      .sendMessage(userId, out.text, { reply_markup: markup(out), link_preview_options: { is_disabled: true } })
      .catch((e) => console.error("Telegram send:", e.message));
  };
  sendTelegram = (userId, text) => senders.telegram!(userId, { text });

  if (config.adminChatId) {
    setAdminNotifier((text) => void bot.api.sendMessage(config.adminChatId, text, { link_preview_options: { is_disabled: true } }).catch((e) => console.error(e.message)));
  }

  void bot.api.setMyCommands([
    { command: "price", description: "Прислать цены сейчас" },
    { command: "status", description: "Мои цены сегодня" },
    { command: "help", description: "Как отвечать боту" },
  ]);

  bot.start({ onStart: (me) => console.log(`Telegram: @${me.username}`) });
  return bot;
}
