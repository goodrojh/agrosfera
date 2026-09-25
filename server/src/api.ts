// HTTP API: публичная часть для сайта (снимок рынка, поток SSE), личный кабинет (cabinet.ts)
// и закрытая паролем часть для панели управления (/admin).

import { createServer, type IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { config, mskDay } from "./config.ts";
import { bids, companies, leads, matches, members, quotes, sessions, type CompanyStatus, type MatchStatus, type Role } from "./db.ts";
import { beginRound, bus, moderate, publishBid, senders } from "./core.ts";
import { scanCrop } from "./matching.ts";
import { handleCabinet } from "./cabinet.ts";
import { hashPassword, isEmail, tempPassword } from "./auth.ts";
import { bearer, clip, json, readJson } from "./http.ts";
import { REGIONS, isRegionId } from "../../lib/market/regions.ts";
import { CROPS, CROP_BY_ID, type CropId } from "../../lib/market/crops.ts";
import type { Bid, Company, Quote } from "../../lib/market/types.ts";

const isCrop = (v: unknown): v is CropId => typeof v === "string" && v in CROP_BY_ID;
const isRole = (v: unknown): v is Role => v === "producer" || v === "exporter" || v === "agent";
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

// ── Панель управления: вход по паролю, токен живёт 12 часов ──────────────────
const adminSessions = new Map<string, number>();
function adminLogin(password: string): string | null {
  if (!config.adminPassword) return null;
  const a = Buffer.from(password);
  const b = Buffer.from(config.adminPassword);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const token = randomBytes(24).toString("hex");
  adminSessions.set(token, Date.now() + 12 * 3600_000);
  return token;
}
function adminAuthorized(req: IncomingMessage): boolean {
  const token = bearer(req);
  const exp = adminSessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

const inviteLink = (code: string) => (config.telegramUsername ? `https://t.me/${config.telegramUsername}?start=${code}` : null);

function adminOverview() {
  const list = companies.list();
  const byId = new Map(list.map((c) => [c.id, c]));
  const brief = (id: string | null) => {
    const c = id ? byId.get(id) : undefined;
    return c ? { id: c.id, name: c.name, code: c.code, role: c.role, person: c.person, phone: c.phone, email: c.email, botConnected: members.ofCompany(c.id).length > 0 } : null;
  };
  return {
    companies: list.map((c) => ({ ...c, inviteLink: inviteLink(c.inviteCode), members: members.ofCompany(c.id) })),
    bids: bids.forAdmin(),
    matches: matches.list().map((m) => ({ ...m, seller: brief(m.sellerCompanyId), buyer: brief(m.buyerCompanyId) })),
    moderation: quotes.byStatus("moderation").map((q) => ({ ...q, companyName: byId.get(q.companyId)?.name ?? q.companyId })),
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
    res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname.replace(/\/$/, "") || "/";

    try {
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

      // ── Личный кабинет ──
      if (await handleCabinet(req, res, path)) return;

      // ── Панель управления ──
      if (req.method === "POST" && path === "/api/admin/login") {
        if (!config.adminPassword) return json(res, 503, { error: "Задайте ADMIN_PASSWORD в server/.env" });
        const body = await readJson(req);
        const token = adminLogin(String(body.password ?? ""));
        if (!token) return json(res, 401, { error: "Неверный пароль" });
        return json(res, 200, { token });
      }

      if (path.startsWith("/api/admin/")) {
        if (!adminAuthorized(req)) return json(res, 401, { error: "Войдите заново" });

        if (req.method === "GET" && path === "/api/admin/overview") return json(res, 200, adminOverview());

        if (req.method === "POST" && path === "/api/admin/companies") {
          const b = await readJson(req);
          const regionId = String(b.regionId ?? "");
          if (clip(b.name, 160).length < 2 || !isRegionId(regionId)) return json(res, 400, { error: "Укажите название и регион" });
          const email = clip(b.email, 120).toLowerCase();
          if (email && (!isEmail(email) || companies.byEmail(email))) return json(res, 400, { error: "Email неверный или уже занят" });
          const c = companies.create({
            role: isRole(b.role) ? b.role : "producer",
            email: email || undefined,
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

        const m = path.match(/^\/api\/admin\/(companies|bids|quotes|matches)\/([^/]+)(?:\/(\w+))?$/);
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
            if (status === "blocked") sessions.removeAll(id);
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

          // Сброс пароля: менеджер передаёт временный пароль участнику
          if (kind === "companies" && action === "password" && req.method === "POST") {
            const c = companies.get(id);
            if (!c) return json(res, 404, { error: "Не найдено" });
            const pwd = tempPassword();
            companies.setPassword(id, hashPassword(pwd));
            sessions.removeAll(id);
            return json(res, 200, { ok: true, password: pwd });
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
            // Заявку поставили в стакан — сразу проверяем, нет ли предприятий дешевле
            const found = b && action === "approve" ? scanCrop(b.crop ?? "flax").length : 0;
            return json(res, 200, { ok: !!b, matches: found });
          }

          if (kind === "quotes" && req.method === "POST" && (action === "approve" || action === "reject")) {
            const q = moderate(id, action === "approve");
            return json(res, 200, { ok: !!q });
          }

          if (kind === "matches" && req.method === "PATCH") {
            const b = await readJson(req);
            const status = ["new", "working", "done", "rejected"].includes(String(b.status)) ? (b.status as MatchStatus) : undefined;
            const upd = matches.update(id, { status, note: typeof b.note === "string" ? clip(b.note, 2000) : undefined });
            return json(res, upd ? 200 : 404, { ok: !!upd });
          }

          // Сообщить сторонам: предприятию — в бот (если подключён), обеим — в личный кабинет
          if (kind === "matches" && action === "notify" && req.method === "POST") {
            const mt = matches.get(id);
            if (!mt) return json(res, 404, { error: "Не найдено" });
            matches.update(id, { notified: true, status: mt.status === "new" ? "working" : mt.status });
            const text = `🤝 Есть покупатель по вашей цене: ${CROP_BY_ID[mt.crop].name} — ${rub(mt.bidPrice)} ₽/т, до ${rub(mt.bidVolume)} т. Менеджер АгроСферы свяжется с вами, чтобы провести сделку.`;
            let sent = 0;
            for (const mb of members.ofCompany(mt.sellerCompanyId)) {
              await senders[mb.channel]?.(mb.userId, { text });
              sent++;
            }
            return json(res, 200, { ok: true, bot: sent });
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

