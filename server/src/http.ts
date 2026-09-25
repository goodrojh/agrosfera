// Общие помощники HTTP для API и личного кабинета.

import type { IncomingMessage, ServerResponse } from "node:http";

export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export async function readJson(req: IncomingMessage, limit = 32_768): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// Ограничение частоты публичных форм: не больше max за 10 минут с одного IP
const hits = new Map<string, number[]>();
export function allow(key: string, max = 5): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 600_000);
  if (list.length >= max) return false;
  list.push(now);
  hits.set(key, list);
  return true;
}

export const clientIp = (req: IncomingMessage) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

export const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export const bearer = (req: IncomingMessage) => String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
