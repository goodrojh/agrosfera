// Бот в Telegram (grammY, long polling).

import { Bot, InlineKeyboard, Keyboard, type Context } from "grammy";
import { config } from "./config.ts";
import { handle, moderate, publishBid, senders, setModerationNotifier, type Incoming, type Outgoing } from "./core.ts";
import { decideApplication, setApplicationNotifier } from "./registration.ts";
import { applications, bids } from "./db.ts";
import { setBidNotifier, setLeadNotifier } from "./api.ts";
import { REGION_BY_ID } from "../../lib/market/regions.ts";

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

function markup(out: Outgoing) {
  if (out.requestContact) return new Keyboard().requestContact("📱 Отправить номер").resized().oneTime();
  if (out.removeKeyboard) return { remove_keyboard: true as const };
  if (!out.buttons?.length) return undefined;
  const kb = new InlineKeyboard();
  // Много кнопок (регионы) — по две в ряд, мало — в одну строку
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
  const isAdminChat = (ctx: Context) => !!config.adminChatId && String(ctx.chat?.id) === config.adminChatId;
  const replyAll = async (ctx: Context, outs: Outgoing[]) => {
    for (const out of outs) await ctx.reply(out.text, { reply_markup: markup(out) });
  };

  bot.command("id", (ctx) => ctx.reply(`ID этого чата: ${ctx.chat.id}\nУкажите его в ADMIN_CHAT_ID, чтобы получать анкеты и заявки.`));

  bot.command("start", async (ctx) => {
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), text: "/start", startPayload: ctx.match || undefined }));
  });

  bot.command("pending", async (ctx) => {
    if (!isAdminChat(ctx)) return;
    const list = applications.pending();
    await ctx.reply(list.length ? list.map((a) => `• ${a.companyName}, ИНН ${a.inn} — ${REGION_BY_ID[a.regionId].name}`).join("\n") : "Анкет на проверке нет.");
  });

  bot.on("message:contact", async (ctx) => {
    // Принимаем только свой номер, а не пересланный чужой контакт
    if (ctx.message.contact.user_id && ctx.message.contact.user_id !== ctx.from.id) {
      return ctx.reply("Отправьте, пожалуйста, свой номер — кнопкой «Отправить номер».");
    }
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), phone: ctx.message.contact.phone_number }));
  });

  bot.on("message:text", async (ctx) => {
    // В общем админ-чате (группе) бот цены не принимает; в личке админ может тестировать как предприятие
    if (isAdminChat(ctx) && ctx.chat.type !== "private") return;
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), text: ctx.message.text }));
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const adminOnly = data.startsWith("mod:") || data.startsWith("app:") || data.startsWith("bid:");
    if (adminOnly && !isAdminChat(ctx)) return ctx.answerCallbackQuery({ text: "Только для модератора" });

    if (data.startsWith("mod:")) {
      const [, action, id] = data.split(":");
      const q = moderate(id, action === "ok");
      await ctx.answerCallbackQuery({ text: q ? (q.status === "accepted" ? "Принято в индекс" : "Отклонено") : "Не найдено" });
      await ctx.editMessageReplyMarkup().catch(() => {});
      if (q) await ctx.reply(`${q.status === "accepted" ? "✅ Принято" : "⛔ Отклонено"}: ${rub(q.price)} ₽/т`);
      return;
    }

    if (data.startsWith("app:")) {
      const [, action, id] = data.split(":");
      const res = decideApplication(id, action === "ok");
      await ctx.answerCallbackQuery({ text: res ? (action === "ok" ? "Предприятие подтверждено" : "Анкета отклонена") : "Уже решено" });
      await ctx.editMessageReplyMarkup().catch(() => {});
      if (res) {
        await senders[res.app.channel]?.(res.app.userId, res.message);
        await ctx.reply(`${action === "ok" ? "✅ Подтверждено" : "⛔ Отклонено"}: ${res.app.companyName}`);
      }
      return;
    }

    if (data.startsWith("bid:")) {
      const [, action, id] = data.split(":");
      const b = action === "ok" ? bids.approve(id) : bids.remove(id);
      if (b) publishBid(b);
      await ctx.answerCallbackQuery({ text: b ? (action === "ok" ? "Заявка в стакане" : "Заявка снята") : "Не найдено" });
      await ctx.editMessageReplyMarkup().catch(() => {});
      return;
    }

    // Кнопки диалога с предприятием: подтверждение цены, анкета
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup().catch(() => {});
    await replyAll(ctx, handle({ channel: "telegram", ...who(ctx), button: data }));
  });

  bot.catch((err) => console.error("Telegram:", err.error));

  senders.telegram = async (userId, out) => {
    await bot.api.sendMessage(userId, out.text, { reply_markup: markup(out) }).catch((e) => console.error("Telegram send:", e.message));
  };
  sendTelegram = (userId, text) => senders.telegram!(userId, { text });

  if (config.adminChatId) {
    const toAdmin = (text: string, kb?: InlineKeyboard) =>
      void bot.api.sendMessage(config.adminChatId, text, { reply_markup: kb, link_preview_options: { is_disabled: true } }).catch((e) => console.error(e.message));

    setLeadNotifier((text) => toAdmin(text));

    setApplicationNotifier((a, existing) => {
      const kb = new InlineKeyboard().text("✅ Подтвердить", `app:ok:${a.id}`).text("⛔ Отклонить", `app:no:${a.id}`);
      toAdmin(
        `🆕 Анкета предприятия\n\n${a.companyName}\nИНН ${a.inn} (контрольная сумма верна)\nРегион: ${REGION_BY_ID[a.regionId].name}\n` +
          `Контакт: ${a.person}\nТелефон: ${a.phone}\nTelegram: ${a.userHandle ?? a.userName ?? a.userId}\n` +
          (existing ? `\n⚠️ ИНН уже в базе: ${existing.code} «${existing.name}» — сотрудник будет привязан к нему.\n` : "") +
          `\nПроверить: https://www.rusprofile.ru/search?query=${a.inn}`,
        kb
      );
    });

    setBidNotifier((b, contact) => {
      const kb = new InlineKeyboard().text("✅ В стакан", `bid:ok:${b.id}`).text("🗑 Отклонить", `bid:del:${b.id}`);
      const where = b.regions.length ? b.regions.map((r) => REGION_BY_ID[r].name).join(", ") : "любые";
      toAdmin(
        `🟢 Заявка на покупку (${b.buyer === "agent" ? "агент" : "экспортёр"}) — ждёт проверки\n${rub(b.price)} ₽/т · ${rub(b.volume)} т\nРегионы: ${where}\n${contact}`,
        kb
      );
    });

    setModerationNotifier((q, company) => {
      const kb = new InlineKeyboard().text("✅ В индекс", `mod:ok:${q.id}`).text("⛔ Отклонить", `mod:no:${q.id}`);
      toAdmin(`🔎 Цена на проверку\n${company}\n${rub(q.price)} ₽/т · ${rub(q.volume)} т`, kb);
    });
  } else {
    console.log("Telegram: ADMIN_CHAT_ID не задан — анкеты и заявки некому проверять. Напишите боту /id и укажите ID в .env");
  }

  void bot.api.setMyCommands([
    { command: "start", description: "Начать / как прислать цену" },
    { command: "status", description: "Моя цена сегодня" },
    { command: "help", description: "Формат сообщения" },
  ]);

  bot.start({ onStart: (me) => console.log(`Telegram: @${me.username}`) });
  return bot;
}
