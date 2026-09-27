// HTTP API: публичная часть для сайта (сводка, поток SSE, заявки экспортёров, анкета партнёра)
// и закрытая паролем часть для панели управления (/admin).

import { createServer, type IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { config, mskDay } from "./config.ts";
import { companies, leads, members, quotes, type CompanyStatus, type LeadStatus } from "./db.ts";
import { beginRound, bus, moderate, notifyAdmin, senders } from "./core.ts";
import { allow, bearer, clientIp, clip, json, readJson } from "./http.ts";
import { OFFER_TTL } from "../../lib/market/aggregate.ts";
import { describe } from "../../lib/market/dialog.ts";
import { isValidInn } from "../../lib/market/inn.ts";
import { REGIONS, REGION_BY_ID, isRegionId, localSince } from "../../lib/market/regions.ts";
import { CROPS, CROP_BY_ID, type CropId } from "../../lib/market/crops.ts";
import type { Company, Quote } from "../../lib/market/types.ts";

const isCrop = (v: unknown): v is CropId => typeof v === "string" && v in CROP_BY_ID;
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");
const phoneOk = (p: string) => p.replace(/\D/g, "").length >= 10;
/** Сводка за 3 дня + ещё сутки — чтобы график за день начинался с полуночи */
const RECENT = OFFER_TTL + 24 * 3600_000;

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
  const now = Date.now();
  const list = companies.list().filter((c) => c.role === "producer");
  const byId = new Map(list.map((c) => [c.id, c]));
  const last = quotes.lastAnswers();
  return {
    companies: list.map((c) => {
      const tz = REGION_BY_ID[c.regionId]?.tz ?? "Europe/Moscow";
      const at = last.get(c.id) ?? null;
      return { ...c, inviteLink: inviteLink(c.inviteCode), members: members.ofCompany(c.id), lastAnswer: at, answeredToday: !!at && at >= localSince(now, tz, 0) };
    }),
    moderation: quotes.byStatus("moderation").map((q) => ({ ...q, companyName: byId.get(q.companyId)?.name ?? q.companyId })),
    leads: leads.recent().map((l) => ({ ...l, seller: l.sellerId ? (byId.get(l.sellerId) ? { name: byId.get(l.sellerId)!.name, code: byId.get(l.sellerId)!.code, phone: byId.get(l.sellerId)!.phone, person: byId.get(l.sellerId)!.person } : null) : null })),
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
    const ip = clientIp(req);

    try {
      if (req.method === "GET" && (path === "/admin" || path === "/")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(adminPage());
        return;
      }

      if (req.method === "GET" && path === "/api/health") return json(res, 200, { ok: true, time: Date.now() });

      // ── Сводка для сайта: предприятия без названий, ответы за последние дни, дневные закрытия ──
      if (req.method === "GET" && path === "/api/snapshot") {
        const crop = isCrop(url.searchParams.get("crop")) ? (url.searchParams.get("crop") as CropId) : "flax";
        const now = Date.now();
        return json(res, 200, {
          crop,
          companies: companies.publicList(crop),
          recent: quotes.since(now - RECENT, crop).filter((q) => q.status !== "moderation"),
          history: quotes.history(mskDay(now), crop),
          serverTime: now,
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
        // Цены на проверке наружу не отдаём
        const onQuote = (q: Quote) => q.status !== "moderation" && res.write(`event: quote\ndata: ${JSON.stringify(q)}\n\n`);
        const onCompany = (c: Company) => res.write(`event: company\ndata: ${JSON.stringify(c)}\n\n`);
        bus.on("quote", onQuote);
        bus.on("company", onCompany);
        const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
        req.on("close", () => {
          clearInterval(ping);
          bus.off("quote", onQuote);
          bus.off("company", onCompany);
        });
        return;
      }

      // ── Заявка экспортёра или агента: на предложение из сводки или общий запрос ──
      if (req.method === "POST" && path === "/api/leads") {
        if (!allow(`lead:${ip}`, 8)) return json(res, 429, { error: "Слишком много заявок подряд — попробуйте через 10 минут" });
        const b = await readJson(req);
        const name = clip(b.name, 120);
        const phone = clip(b.phone, 40);
        if (name.length < 2) return json(res, 400, { error: "Укажите имя" });
        if (!phoneOk(phone)) return json(res, 400, { error: "Укажите телефон для связи" });
        const crop = isCrop(b.crop) ? b.crop : null;
        const volume = Math.round(Number(b.volume)) || null;
        const common = { name, phone, company: clip(b.company, 160), comment: clip(b.comment, 1000), volume, crop };

        if (typeof b.offerId === "string" && b.offerId) {
          const q = quotes.get(b.offerId);
          if (!q || q.status !== "accepted") return json(res, 400, { error: "Предложение уже обновилось — обновите страницу" });
          const c = CROP_BY_ID[q.crop ?? "flax"];
          const offer = `${REGION_BY_ID[q.regionId].name} · ${describe({ ...q, moisture: q.moisture ?? 0, impurity: q.impurity ?? 0 }, c.quality)}`;
          const lead = leads.insert({ ...common, kind: "offer", crop: q.crop ?? "flax", target: REGION_BY_ID[q.regionId].name, price: q.price, offer, sellerId: q.companyId });
          const seller = companies.get(q.companyId);
          notifyAdmin(
            `🟢 Заявка на предложение №${lead.id}\n${c.name}: ${offer}\nПредприятие: ${seller?.name ?? "—"} (${seller?.code ?? ""})\n` +
              `Покупатель: ${name}${common.company ? `, ${common.company}` : ""}, ${phone}${volume ? `\nНужно: ${rub(volume)} т` : ""}${common.comment ? `\n${common.comment}` : ""}`
          );
          return json(res, 200, { ok: true });
        }

        const regions = Array.isArray(b.regions) ? b.regions.filter((r: unknown) => typeof r === "string" && isRegionId(r)) : [];
        const price = Math.round(Number(b.price)) || null;
        const target = regions.length ? regions.map((r: string) => REGION_BY_ID[r as keyof typeof REGION_BY_ID].name).join(", ") : "любые регионы";
        const lead = leads.insert({ ...common, kind: "request", target, price, offer: "", sellerId: null });
        notifyAdmin(
          `📋 Запрос №${lead.id}: ${crop ? CROP_BY_ID[crop].name : "культура не указана"} · ${target}${volume ? ` · ${rub(volume)} т` : ""}${price ? ` · до ${rub(price)} ₽/т` : ""}\n` +
            `${name}${common.company ? `, ${common.company}` : ""}, ${phone}${common.comment ? `\n${common.comment}` : ""}`
        );
        return json(res, 200, { ok: true });
      }

      // ── Анкета предприятия «Стать партнёром» ──
      if (req.method === "POST" && path === "/api/apply") {
        if (!allow(`apply:${ip}`, 5)) return json(res, 429, { error: "Слишком много анкет подряд — попробуйте позже" });
        const b = await readJson(req);
        const name = clip(b.name, 160);
        const inn = clip(b.inn, 20).replace(/\D/g, "");
        const regionId = String(b.regionId ?? "");
        const person = clip(b.person, 160);
        const phone = clip(b.phone, 40);
        const crops = Array.isArray(b.crops) ? (b.crops.filter(isCrop) as CropId[]) : [];
        const comment = clip(b.comment, 1000);
        if (name.length < 2) return json(res, 400, { error: "Укажите название предприятия" });
        if (inn && inn.length !== 10 && inn.length !== 12) return json(res, 400, { error: "ИНН — 10 или 12 цифр. Если ИНН нет, оставьте поле пустым" });
        if (!isRegionId(regionId)) return json(res, 400, { error: "Выберите регион" });
        if (person.length < 2) return json(res, 400, { error: "Укажите контактное лицо" });
        if (!phoneOk(phone)) return json(res, 400, { error: "Укажите телефон — по нему бот узнает вас после проверки" });
        if (!crops.length) return json(res, 400, { error: "Отметьте культуры, которые продаёте" });
        const stamp = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
        const innNote = !inn ? "⚠️ ИНН не указан — уточнить при звонке." : !isValidInn(inn) ? "⚠️ ИНН не прошёл проверку контрольной суммы — проверить вручную." : "";
        companies.create({
          name, inn: inn || undefined, regionId, status: "new", crops, person, phone, source: "site",
          notes: [innNote, comment ? `[${stamp}] Из анкеты: ${comment}` : ""].filter(Boolean).join("\n"),
        });
        notifyAdmin(`🆕 Анкета предприятия: ${name}, ${REGION_BY_ID[regionId].name}. ${person}, ${phone}. Культуры: ${crops.map((c) => CROP_BY_ID[c].name).join(", ")}. Панель → «Анкеты».`);
        return json(res, 200, { ok: true });
      }

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

        const m = path.match(/^\/api\/admin\/(companies|quotes|leads)\/([^/]+)(?:\/(\w+))?$/);
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
                  text: `✅ Доступ открыт. Культуры: ${after.crops.map((c) => CROP_BY_ID[c].name).join(", ") || "не закреплены"}. Каждое утро в 8:00 по вашему времени бот попросит предложение.`,
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
              for (const out of beginRound(mb.channel, mb.userId, c, "morning")) await senders[mb.channel]?.(mb.userId, out);
            }
            return json(res, 200, { ok: true, sent: list.length });
          }

          if (kind === "quotes" && req.method === "POST" && (action === "approve" || action === "reject")) {
            const q = moderate(id, action === "approve");
            return json(res, 200, { ok: !!q });
          }

          if (kind === "leads" && req.method === "PATCH") {
            const b = await readJson(req);
            const status = ["new", "working", "done", "rejected"].includes(String(b.status)) ? (b.status as LeadStatus) : undefined;
            const upd = leads.update(Number(id), { status, note: typeof b.note === "string" ? clip(b.note, 2000) : undefined });
            return json(res, upd ? 200 : 404, { ok: !!upd });
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
