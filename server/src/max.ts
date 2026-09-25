// Бот в мессенджере MAX (Bot API platform-api.max.ru, long polling).
// Документация: https://dev.max.ru/docs-api — при изменении API сверить эндпоинты ниже.

import { config } from "./config.ts";
import { handle, type Outgoing } from "./core.ts";
import type { ButtonId } from "../../lib/market/dialog.ts";

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
  const attachments = out.buttons?.length
    ? [
        {
          type: "inline_keyboard",
          payload: { buttons: [out.buttons.map((b) => ({ type: "callback", text: b.label, payload: `b:${b.id}` }))] },
        },
      ]
    : undefined;
  await api("POST", "/messages", { user_id: userId }, { text: out.text, attachments }).catch((e) => console.error(e.message));
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
            await send(userId, handle({ channel: "max", userId, userName: u.user.name, text: "/start", startPayload: u.payload }));
          } else if (u.update_type === "message_created" && u.message?.sender && u.message.body?.text) {
            const userId = String(u.message.sender.user_id);
            await send(userId, handle({ channel: "max", userId, userName: u.message.sender.name, text: u.message.body.text }));
          } else if (u.update_type === "message_callback" && u.callback) {
            const userId = String(u.callback.user.user_id);
            await api("POST", "/answers", { callback_id: u.callback.callback_id }, { notification: "✓" }).catch(() => {});
            const payload = u.callback.payload ?? "";
            if (payload.startsWith("b:")) {
              await send(userId, handle({ channel: "max", userId, userName: u.callback.user.name, button: payload.slice(2) as ButtonId }));
            }
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
