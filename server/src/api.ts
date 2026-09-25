// HTTP API для сайта: снимок рынка, поток обновлений (SSE) и заявки.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { config, mskDay } from "./config.ts";
import { bids, companies, leads, quotes } from "./db.ts";
import { bus } from "./core.ts";
import { computeIndex, latestAccepted } from "../../lib/market/aggregate.ts";
import { checkBid } from "../../lib/market/validate.ts";
import { isRegionId } from "../../lib/market/regions.ts";
import type { Bid, Company, Quote } from "../../lib/market/types.ts";

export let notifyLead: (text: string) => void = () => {};
export function setLeadNotifier(fn: typeof notifyLead) {
  notifyLead = fn;
}

/** Новая заявка покупателя — в админ-чат с кнопкой «Снять» */
export let notifyBid: (b: Bid, who: string) => void = () => {};
export function setBidNotifier(fn: typeof notifyBid) {
  notifyBid = fn;
}

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 16_384): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Простое ограничение заявок: не больше 5 за 10 минут с одного IP
const leadHits = new Map<string, number[]>();
function allowLead(ip: string): boolean {
  const now = Date.now();
  const hits = (leadHits.get(ip) ?? []).filter((t) => now - t < 600_000);
  if (hits.length >= 5) return false;
  hits.push(now);
  leadHits.set(ip, hits);
  return true;
}
const clientIp = (req: IncomingMessage) =>
  String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

const ROLE_LABEL: Record<string, string> = { exporter: "Экспортёр", agent: "Агент", producer: "Производитель" };
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export function startApi() {
  const server = createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");

    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        return json(res, 200, { ok: true, time: Date.now() });
      }

      if (req.method === "GET" && url.pathname === "/api/snapshot") {
        const today = mskDay(Date.now());
        return json(res, 200, {
          companies: companies.publicList(),
          today: quotes.ofDay(today),
          history: quotes.history(today),
          bids: bids.active(),
          serverTime: Date.now(),
        });
      }

      if (req.method === "GET" && url.pathname === "/api/stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.write("retry: 5000\n\n");
        let day = mskDay(Date.now());
        const onQuote = (q: Quote) => res.write(`event: quote\ndata: ${JSON.stringify(q)}\n\n`);
        const onCompany = (c: Company) => res.write(`event: company\ndata: ${JSON.stringify(c)}\n\n`);
        const onBid = (b: Bid) => res.write(`event: bid\ndata: ${JSON.stringify(b)}\n\n`);
        bus.on("quote", onQuote);
        bus.on("company", onCompany);
        bus.on("bid", onBid);
        const ping = setInterval(() => {
          res.write(": ping\n\n");
          // Наступил новый день — сайт перезагрузит снимок
          const d = mskDay(Date.now());
          if (d !== day) {
            day = d;
            res.write("event: reset\ndata: {}\n\n");
          }
        }, 25_000);
        req.on("close", () => {
          clearInterval(ping);
          bus.off("quote", onQuote);
          bus.off("company", onCompany);
          bus.off("bid", onBid);
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/bids") {
        const ip = clientIp(req);
        if (!allowLead(ip)) return json(res, 429, { error: "Слишком много заявок, попробуйте позже" });
        const body = JSON.parse(await readBody(req));
        const price = Math.round(Number(body.price));
        const volume = Math.round(Number(body.volume));
        const regions = Array.isArray(body.regions) ? body.regions.filter((r: unknown) => typeof r === "string" && isRegionId(r)) : [];
        const name = clip(body.name, 120);
        const contact = clip(body.contact, 120);
        const buyer = body.buyer === "agent" ? "agent" : "exporter";
        if (body.crop && body.crop !== "flax") return json(res, 400, { error: "Пока принимаем заявки только на лён" });
        const reference = computeIndex([...latestAccepted(quotes.ofDay(mskDay(Date.now()))).values()])?.index;
        const err = checkBid(price, volume, reference);
        if (err) return json(res, 400, { error: err });
        if (name.length < 2 || contact.length < 5) return json(res, 400, { error: "Укажите имя и телефон / Telegram" });
        const bid = bids.insert({ crop: "flax", price, volume, regions, buyer, name, contact, ip });
        // В стакан попадает только после подтверждения модератором
        notifyBid(bid, `${name} · ${contact}`);
        return json(res, 200, { ok: true, bid, pending: true });
      }

      if (req.method === "POST" && url.pathname === "/api/leads") {
        const ip = clientIp(req);
        if (!allowLead(ip)) return json(res, 429, { error: "Слишком много заявок, попробуйте позже" });
        const body = JSON.parse(await readBody(req));
        const lead = {
          role: ROLE_LABEL[body.role] ? String(body.role) : "exporter",
          name: clip(body.name, 120),
          contact: clip(body.contact, 120),
          target: clip(body.target, 40),
          volume: Number.isFinite(Number(body.volume)) && body.volume !== null ? Math.max(0, Math.round(Number(body.volume))) : null,
          comment: clip(body.comment, 1000),
        };
        if (lead.name.length < 2 || lead.contact.length < 5) return json(res, 400, { error: "Заполните имя и контакт" });
        leads.insert(lead);
        notifyLead(
          `📥 Заявка с сайта\nРоль: ${ROLE_LABEL[lead.role]}\nИмя: ${lead.name}\nКонтакт: ${lead.contact}\n` +
            `Направление/регион: ${lead.target}\nОбъём: ${lead.volume ?? "—"} т` +
            (lead.comment ? `\nКомментарий: ${lead.comment}` : "")
        );
        return json(res, 200, { ok: true });
      }

      json(res, 404, { error: "not found" });
    } catch (e) {
      console.error(e);
      json(res, 500, { error: "server error" });
    }
  });

  server.listen(config.port, () => console.log(`API: http://localhost:${config.port}`));
  return server;
}
