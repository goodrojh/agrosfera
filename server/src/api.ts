// HTTP API: публичная часть для сайта (снимок рынка, поток SSE, заявки, анкеты)
// и закрытая паролем часть для панели управления (/admin).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { config, mskDay } from "./config.ts";
import { bids, companies, leads, members, quotes, type CompanyStatus } from "./db.ts";
import { beginRound, bus, moderate, notifyAdmin, publishBid, senders } from "./core.ts";
import { computeIndex, latestAccepted } from "../../lib/market/aggregate.ts";
import { checkBid } from "../../lib/market/validate.ts";
import { isValidInn } from "../../lib/market/inn.ts";
import { REGIONS, REGION_BY_ID, isRegionId } from "../../lib/market/regions.ts";
import { CROPS, CROP_BY_ID, type CropId } from "../../lib/market/crops.ts";
import type { Bid, Company, Quote } from "../../lib/market/types.ts";

const isCrop = (v: unknown): v is CropId => typeof v === "string" && v in CROP_BY_ID;
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limit = 32_768): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// Ограничение публичных форм: не больше 5 за 10 минут с одного IP
const hits = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  if (list.length >= 5) return false;
  list.push(now);
  hits.set(ip, list);
  return true;
}
const clientIp = (req: IncomingMessage) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

const ROLE_LABEL: Record<string, string> = { exporter: "Экспортёр", agent: "Агент", producer: "Производитель" };
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// ── Панель управления: вход по паролю, токен живёт 12 часов ──────────────────
const sessions = new Map<string, number>();
function login(password: string): string | null {
  if (!config.adminPassword) return null;
  const a = Buffer.from(password);
  const b = Buffer.from(config.adminPassword);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const token = randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + 12 * 3600_000);
  return token;
}
function authorized(req: IncomingMessage): boolean {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

const inviteLink = (code: string) => (config.telegramUsername ? `https://t.me/${config.telegramUsername}?start=${code}` : null);

function adminOverview() {
  const list = companies.list();
  const nameOf = new Map(list.map((c) => [c.id, c.name]));
  return {
    companies: list.map((c) => ({
      ...c,
      inviteLink: inviteLink(c.inviteCode),
      members: members.ofCompany(c.id),
    })),
    bids: bids.forAdmin(),
    moderation: quotes.byStatus("moderation").map((q) => ({ ...q, companyName: nameOf.get(q.companyId) ?? q.companyId })),
    leads: leads.recent(),
    bot: config.telegramUsername ? `@${config.telegramUsername}` : null,
    regions: REGIONS.map((r) => ({ id: r.id, name: r.name })),
    crops: CROPS.map((c) => ({ id: c.id, name: c.name })),
  };
}

let adminHtml: string | null = null;
const adminPage = () => (adminHtml ??= readFileSync(new URL("../admin/index.html", import.meta.url), "utf8"));

export function startApi() {
  const server = createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname.replace(/\/$/, "") || "/";

    try {
      // ── Страница панели управления ──
      if (req.method === "GET" && (path === "/admin" || path === "/")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(adminPage());
        return;
      }

      if (req.method === "GET" && path === "/api/health") return json(res, 200, { ok: true, time: Date.now() });

      // ── Публичные данные для сайта ──
      if (req.method === "GET" && path === "/api/snapshot") {
        const crop = isCrop(url.searchParams.get("crop")) ? (url.searchParams.get("crop") as CropId) : "flax";
        const today = mskDay(Date.now());
        return json(res, 200, {
          crop,
          companies: companies.publicList(crop),
          today: quotes.ofDay(today, crop),
          history: quotes.history(today, crop),
          bids: bids.active(crop),
          serverTime: Date.now(),
        });
      }

      if (req.method === "GET" && path === "/api/stream") {
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

      // ── Анкета производителя с сайта: попадает в панель со статусом «новая» ──
      if (req.method === "POST" && path === "/api/apply") {
        if (!allow(clientIp(req))) return json(res, 429, { error: "Слишком много заявок, попробуйте позже" });
        const b = await readJson(req);
        const name = clip(b.name, 160);
        const inn = clip(b.inn, 12).replace(/\s/g, "");
        const regionId = String(b.regionId ?? "");
        const crops = Array.isArray(b.crops) ? (b.crops.filter(isCrop) as CropId[]) : [];
        const person = clip(b.person, 160);
        const phone = clip(b.phone, 40);
        const telegram = clip(b.telegram, 60);
        const comment = clip(b.comment, 1000);
        if (name.length < 3) return json(res, 400, { error: "Укажите название предприятия" });
        if (!isValidInn(inn)) return json(res, 400, { error: "ИНН не проходит проверку. Проверьте цифры" });
        if (!isRegionId(regionId)) return json(res, 400, { error: "Выберите регион" });
        if (person.length < 3) return json(res, 400, { error: "Укажите контактное лицо" });
        if (phone.replace(/\D/g, "").length < 10) return json(res, 400, { error: "Укажите телефон — по нему бот узнает вас" });

        const existing = companies.byInn(inn);
        const stamp = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
        if (existing) {
          companies.update(existing.id, { notes: `${existing.notes}\n[${stamp}] Повторная анкета с сайта: ${person}, ${phone}. ${comment}`.trim() });
        } else {
          companies.create({
            name,
            inn,
            regionId,
            status: "new",
            crops,
            person,
            phone,
            telegram,
            notes: comment ? `[${stamp}] Комментарий из анкеты: ${comment}` : "",
            source: "site",
          });
        }
        notifyAdmin(`🆕 Анкета производителя: ${name}, ИНН ${inn}, ${REGION_BY_ID[regionId].name}. ${person}, ${phone}. Откройте панель управления, чтобы проверить.`);
        return json(res, 200, { ok: true });
      }

      if (req.method === "POST" && path === "/api/bids") {
        if (!allow(clientIp(req))) return json(res, 429, { error: "Слишком много заявок, попробуйте позже" });
        const body = await readJson(req);
        const crop = isCrop(body.crop) ? body.crop : "flax";
        const price = Math.round(Number(body.price));
        const volume = Math.round(Number(body.volume));
        const regions = Array.isArray(body.regions) ? body.regions.filter((r: unknown) => typeof r === "string" && isRegionId(r)) : [];
        const name = clip(body.name, 120);
        const contact = clip(body.contact, 120);
        const buyer = body.buyer === "agent" ? "agent" : "exporter";
        const reference = computeIndex([...latestAccepted(quotes.ofDay(mskDay(Date.now()), crop)).values()])?.index;
        const err = checkBid(price, volume, reference);
        if (err) return json(res, 400, { error: err });
        if (name.length < 2 || contact.length < 5) return json(res, 400, { error: "Укажите имя и телефон / Telegram" });
        const bid = bids.insert({ crop, price, volume, regions, buyer, name, contact, ip: clientIp(req) });
        // В стакан попадает только после подтверждения в панели управления
        notifyAdmin(
          `🟢 Заявка на покупку (${buyer === "agent" ? "агент" : "экспортёр"}), ${CROP_BY_ID[crop].name}: ${rub(price)} ₽/т · ${rub(volume)} т. ${name}, ${contact}. Ждёт проверки в панели.`
        );
        return json(res, 200, { ok: true, bid, pending: true });
      }

      if (req.method === "POST" && path === "/api/leads") {
        if (!allow(clientIp(req))) return json(res, 429, { error: "Слишком много заявок, попробуйте позже" });
        const body = await readJson(req);
        const lead = {
          role: ROLE_LABEL[String(body.role)] ? String(body.role) : "exporter",
          name: clip(body.name, 120),
          contact: clip(body.contact, 120),
          target: clip(body.target, 40),
          volume: body.volume !== null && Number.isFinite(Number(body.volume)) ? Math.max(0, Math.round(Number(body.volume))) : null,
          comment: clip(body.comment, 1000),
        };
        if (lead.name.length < 2 || lead.contact.length < 5) return json(res, 400, { error: "Заполните имя и контакт" });
        leads.insert(lead);
        notifyAdmin(`📥 Заявка с сайта (${ROLE_LABEL[lead.role]}): ${lead.name}, ${lead.contact}. ${lead.comment}`);
        return json(res, 200, { ok: true });
      }

      // ── Панель управления ──
      if (req.method === "POST" && path === "/api/admin/login") {
        if (!config.adminPassword) return json(res, 503, { error: "Задайте ADMIN_PASSWORD в server/.env" });
        const body = await readJson(req);
        const token = login(String(body.password ?? ""));
        if (!token) return json(res, 401, { error: "Неверный пароль" });
        return json(res, 200, { token });
      }

      if (path.startsWith("/api/admin/")) {
        if (!authorized(req)) return json(res, 401, { error: "Войдите заново" });

        if (req.method === "GET" && path === "/api/admin/overview") return json(res, 200, adminOverview());

        if (req.method === "POST" && path === "/api/admin/companies") {
          const b = await readJson(req);
          const regionId = String(b.regionId ?? "");
          if (clip(b.name, 160).length < 2 || !isRegionId(regionId)) return json(res, 400, { error: "Укажите название и регион" });
          const c = companies.create({
            name: clip(b.name, 160),
            inn: clip(b.inn, 12) || undefined,
            regionId,
            status: "new",
            crops: Array.isArray(b.crops) ? (b.crops.filter(isCrop) as CropId[]) : [],
            person: clip(b.person, 160) || undefined,
            phone: clip(b.phone, 40) || undefined,
            source: "admin",
          });
          return json(res, 200, { ok: true, id: c.id });
        }

        const m = path.match(/^\/api\/admin\/(companies|bids|quotes)\/([^/]+)(?:\/(\w+))?$/);
        if (m) {
          const [, kind, id, action] = m;

          if (kind === "companies" && req.method === "PATCH") {
            const b = await readJson(req);
            const before = companies.get(id);
            if (!before) return json(res, 404, { error: "Не найдено" });
            const status = ["new", "active", "blocked"].includes(String(b.status)) ? (b.status as CompanyStatus) : undefined;
            const regionId = typeof b.regionId === "string" && isRegionId(b.regionId) ? b.regionId : undefined;
            const after = companies.update(id, {
              status,
              regionId,
              crops: Array.isArray(b.crops) ? (b.crops.filter(isCrop) as CropId[]) : undefined,
              notes: typeof b.notes === "string" ? clip(b.notes, 20_000) : undefined,
              name: typeof b.name === "string" && b.name.trim().length > 1 ? clip(b.name, 160) : undefined,
              person: typeof b.person === "string" ? clip(b.person, 160) : undefined,
              phone: typeof b.phone === "string" ? clip(b.phone, 40) : undefined,
              inn: typeof b.inn === "string" ? clip(b.inn, 12) : undefined,
            })!;
            // Доступ только что открыли, а бот уже подключён — сразу сообщаем
            if (!before.active && after.active) {
              for (const mb of members.ofCompany(id)) {
                await senders[mb.channel]?.(mb.userId, {
                  text: `✅ Доступ открыт. Культуры: ${after.crops.map((c) => CROP_BY_ID[c].name).join(", ") || "не закреплены"}.`,
                });
              }
            }
            return json(res, 200, { ok: true });
          }

          if (kind === "companies" && action === "ask" && req.method === "POST") {
            const c = companies.get(id);
            if (!c || !c.active) return json(res, 400, { error: "Сначала откройте доступ" });
            const list = members.ofCompany(id);
            for (const mb of list) {
              for (const out of beginRound(mb.channel, mb.userId, c)) await senders[mb.channel]?.(mb.userId, out);
            }
            return json(res, 200, { ok: true, sent: list.length });
          }

          if (kind === "bids" && req.method === "POST" && (action === "approve" || action === "reject")) {
            const b = action === "approve" ? bids.approve(id) : bids.remove(id);
            if (b) publishBid(b);
            return json(res, 200, { ok: !!b });
          }

          if (kind === "quotes" && req.method === "POST" && (action === "approve" || action === "reject")) {
            const q = moderate(id, action === "approve");
            return json(res, 200, { ok: !!q });
          }
        }
        return json(res, 404, { error: "not found" });
      }

      json(res, 404, { error: "not found" });
    } catch (e) {
      console.error(e);
      json(res, 500, { error: "server error" });
    }
  });

  server.listen(config.port, () => console.log(`API и панель управления: http://localhost:${config.port}/admin`));
  return server;
}
