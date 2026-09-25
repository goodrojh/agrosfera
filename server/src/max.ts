// Бот в мессенджере MAX (Bot API platform-api.max.ru, long polling).
// Документация: https://dev.max.ru/docs-api — при изменении API сверить эндпоинты ниже.

import { config } from "./config.ts";
import { handle, senders, type Outgoing } from "./core.ts";

const BASE = "https://platform-api.max.ru";

async function api<T = unknown>(method: "GET" | "POST", path: string, params: Record<string, string | number> = {}, body?: unknown): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${BASE}${path}${qs.size ? "?" + qs : ""}`, {
    method,
    headers: { Authorization: config.maxToken, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`MAX ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function send(userId: string, out: Outgoing) {
  const rows: { type: string; text: string; payload?: string }[][] = [];
  const perRow = (out.buttons?.length ?? 0) > 2 ? 2 : 3;
  (out.buttons ?? []).forEach((b, i) => {
    if (i % perRow === 0) rows.push([]);
    rows[rows.length - 1].push({ type: "callback", text: b.label, payload: b.id });
  });
  // Кнопка «Отправить номер» в MAX
  if (out.requestContact) rows.push([{ type: "request_contact", text: "📱 Отправить номер" }]);
  const attachments = rows.length ? [{ type: "inline_keyboard", payload: { buttons: rows } }] : undefined;
  await api("POST", "/messages", { user_id: userId }, { text: out.text, attachments }).catch((e) => console.error(e.message));
}

async function sendAll(userId: string, outs: Outgoing[]) {
  for (const out of outs) await send(userId, out);
}

export let sendMax: (userId: string, text: string) => Promise<void> = async () => {};

interface MaxUser {
  user_id: number;
  name?: string;
}
interface MaxUpdate {
  update_type: string;
  message?: { sender?: MaxUser; body?: { text?: string } };
  callback?: { callback_id: string; payload?: string; user: MaxUser };
  user?: MaxUser;
  payload?: string;
}

export function startMax() {
  senders.max = send;
  sendMax = (userId, text) => send(userId, { text });
  let marker: number | undefined;
  let stopped = false;

  const loop = async () => {
    while (!stopped) {
      try {
        const params: Record<string, string | number> = { timeout: 30, types: "message_created,message_callback,bot_started" };
        if (marker !== undefined) params.marker = marker;
        const data = await api<{ updates: MaxUpdate[]; marker?: number }>("GET", "/updates", params);
        if (data.marker !== undefined) marker = data.marker;

        for (const u of data.updates ?? []) {
          if (u.update_type === "bot_started" && u.user) {
            const userId = String(u.user.user_id);
            await sendAll(userId, handle({ channel: "max", userId, userName: u.user.name, text: "/start", startPayload: u.payload }));
          } else if (u.update_type === "message_created" && u.message?.sender && u.message.body?.text) {
            const userId = String(u.message.sender.user_id);
            await sendAll(userId, handle({ channel: "max", userId, userName: u.message.sender.name, text: u.message.body.text }));
          } else if (u.update_type === "message_callback" && u.callback) {
            const userId = String(u.callback.user.user_id);
            await api("POST", "/answers", { callback_id: u.callback.callback_id }, { notification: "✓" }).catch(() => {});
            const payload = u.callback.payload ?? "";
            if (payload) await sendAll(userId, handle({ channel: "max", userId, userName: u.callback.user.name, button: payload }));
          }
        }
      } catch (e) {
        console.error((e as Error).message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };

  void api<{ name?: string; username?: string }>("GET", "/me")
    .then((me) => console.log(`MAX: ${me.username ?? me.name}`))
    .catch((e) => console.error("MAX: токен не принят —", e.message));
  void loop();
  return () => {
    stopped = true;
  };
}
