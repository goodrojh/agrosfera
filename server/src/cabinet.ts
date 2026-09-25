// Личный кабинет: регистрация и вход по email/паролю, профиль,
// цены предприятия с сайта, заявки покупателя, запросы на сделку.

import type { IncomingMessage, ServerResponse } from "node:http";
import { config, mskDay } from "./config.ts";
import { bids, companies, leads, matches, members, quotes, sessions, type CompanyRow, type Role } from "./db.ts";
import { hashPassword, isEmail, verifyPassword } from "./auth.ts";
import { allow, bearer, clientIp, clip, json, readJson } from "./http.ts";
import { notifyAdmin, publishBid, publishQuote } from "./core.ts";
import { onQuote } from "./matching.ts";
import { latestAccepted, referenceInfo } from "../../lib/market/aggregate.ts";
import { checkBid, checkQuote } from "../../lib/market/validate.ts";
import { isValidInn } from "../../lib/market/inn.ts";
import { REGION_BY_ID, isRegionId } from "../../lib/market/regions.ts";
import { CROP_BY_ID, type CropId } from "../../lib/market/crops.ts";

const isCrop = (v: unknown): v is CropId => typeof v === "string" && v in CROP_BY_ID;
const isRole = (v: unknown): v is Role => v === "producer" || v === "exporter" || v === "agent";
const ROLE_NAME: Record<Role, string> = { producer: "Предприятие", exporter: "Экспортёр", agent: "Агент" };
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

/** Профиль для кабинета — без пароля и служебных полей */
function profile(c: CompanyRow) {
  const today = mskDay(Date.now());
  return {
    id: c.id,
    code: c.code,
    role: c.role,
    status: c.status,
    email: c.email,
    name: c.name,
    inn: c.inn,
    regionId: c.regionId,
    person: c.person,
    phone: c.phone,
    crops: c.crops,
    botConnected: members.ofCompany(c.id).length > 0,
    botLink: config.telegramUsername ? `https://t.me/${config.telegramUsername}?start=${c.inviteCode}` : null,
    quotesToday:
      c.role === "producer"
        ? c.crops.map((crop) => {
            const q = latestAccepted(quotes.ofDay(today, crop)).get(c.id);
            return { crop, price: q?.price ?? null, volume: q?.volume ?? null, at: q?.at ?? null };
          })
        : [],
    bids: c.role === "producer" ? [] : bids.ofCompany(c.id),
    matches: matches.notifiedFor(c.id).map((m) => ({
      id: m.id,
      crop: m.crop,
      side: m.sellerCompanyId === c.id ? "sell" : "buy",
      price: m.sellerCompanyId === c.id ? m.bidPrice : m.askPrice,
      volume: m.sellerCompanyId === c.id ? m.bidVolume : m.askVolume,
      regionId: m.regionId,
      status: m.status,
      createdAt: m.createdAt,
    })),
  };
}

function account(req: IncomingMessage): CompanyRow | null {
  const id = sessions.companyId(bearer(req));
  return id ? (companies.get(id) ?? null) : null;
}

/** Обработать /api/auth/* и /api/cabinet/*. Возвращает false, если путь не наш */
export async function handleCabinet(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  if (!path.startsWith("/api/auth/") && !path.startsWith("/api/cabinet") && path !== "/api/me") return false;
  const ip = clientIp(req);

  // ── Регистрация ──
  if (req.method === "POST" && path === "/api/auth/register") {
    if (!allow(`reg:${ip}`, 5)) return json(res, 429, { error: "Слишком много попыток, попробуйте позже" }), true;
    const b = await readJson(req);
    const role = isRole(b.role) ? b.role : null;
    const email = clip(b.email, 120).toLowerCase();
    const password = String(b.password ?? "");
    const name = clip(b.name, 160);
    const inn = clip(b.inn, 20).replace(/\D/g, "");
    const regionId = String(b.regionId ?? "");
    const person = clip(b.person, 160);
    const phone = clip(b.phone, 40);
    const crops = Array.isArray(b.crops) ? (b.crops.filter(isCrop) as CropId[]) : [];
    const comment = clip(b.comment, 1000);

    if (!role) return json(res, 400, { error: "Выберите, кто вы: предприятие, экспортёр или агент" }), true;
    if (!isEmail(email)) return json(res, 400, { error: "Укажите email — это логин в личный кабинет" }), true;
    if (password.length < 8) return json(res, 400, { error: "Пароль — не короче 8 символов" }), true;
    if (companies.byEmail(email)) return json(res, 400, { error: "Этот email уже зарегистрирован. Войдите или восстановите пароль через менеджера" }), true;
    if (name.length < 2) return json(res, 400, { error: "Укажите название компании" }), true;
    if (inn && inn.length !== 10 && inn.length !== 12) return json(res, 400, { error: "ИНН — 10 или 12 цифр. Если ИНН нет, оставьте поле пустым" }), true;
    if (!isRegionId(regionId)) return json(res, 400, { error: "Выберите регион" }), true;
    if (person.length < 3) return json(res, 400, { error: "Укажите контактное лицо" }), true;
    if (phone.replace(/\D/g, "").length < 10) return json(res, 400, { error: "Укажите телефон для связи" }), true;
    if (role === "producer" && !crops.length) return json(res, 400, { error: "Отметьте культуры, которые продаёте" }), true;

    const stamp = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
    const innNote = !inn ? "⚠️ ИНН не указан — уточнить при звонке." : !isValidInn(inn) ? "⚠️ ИНН не прошёл проверку контрольной суммы — проверить вручную." : "";
    const c = companies.create({
      role,
      email,
      passwordHash: hashPassword(password),
      name,
      inn: inn || undefined,
      regionId,
      status: "new",
      crops: role === "producer" ? crops : [],
      person,
      phone,
      notes: [innNote, comment ? `[${stamp}] Из анкеты: ${comment}` : ""].filter(Boolean).join("\n"),
      source: "site",
    });
    notifyAdmin(`🆕 Регистрация: ${ROLE_NAME[role]} ${name}, ${REGION_BY_ID[regionId].name}. ${person}, ${phone}, ${email}. Проверьте в панели → «Анкеты».`);
    return json(res, 200, { token: sessions.create(c.id), account: profile(c) }), true;
  }

  // ── Вход / выход ──
  if (req.method === "POST" && path === "/api/auth/login") {
    if (!allow(`login:${ip}`, 10)) return json(res, 429, { error: "Слишком много попыток, подождите 10 минут" }), true;
    const b = await readJson(req);
    const c = companies.byEmail(String(b.email ?? ""));
    if (!c || !verifyPassword(String(b.password ?? ""), companies.passwordHash(c.id))) return json(res, 401, { error: "Неверный email или пароль" }), true;
    if (c.status === "blocked") return json(res, 403, { error: "Доступ закрыт. Свяжитесь с менеджером АгроСферы" }), true;
    return json(res, 200, { token: sessions.create(c.id), account: profile(c) }), true;
  }
  if (req.method === "POST" && path === "/api/auth/logout") {
    sessions.remove(bearer(req));
    return json(res, 200, { ok: true }), true;
  }

  // ── Дальше — только для вошедших ──
  const me = account(req);
  if (!me) return json(res, 401, { error: "Войдите в личный кабинет" }), true;

  if (req.method === "GET" && path === "/api/me") return json(res, 200, { account: profile(me) }), true;

  if (req.method === "POST" && path === "/api/cabinet/password") {
    const b = await readJson(req);
    if (!verifyPassword(String(b.old ?? ""), companies.passwordHash(me.id))) return json(res, 400, { error: "Текущий пароль указан неверно" }), true;
    if (String(b.password ?? "").length < 8) return json(res, 400, { error: "Новый пароль — не короче 8 символов" }), true;
    companies.setPassword(me.id, hashPassword(String(b.password)));
    return json(res, 200, { ok: true }), true;
  }

  if (me.status !== "active") return json(res, 403, { error: "Аккаунт на проверке. Менеджер свяжется с вами и откроет доступ" }), true;

  // ── Предприятие: цена с сайта ──
  if (req.method === "POST" && path === "/api/cabinet/quote") {
    if (me.role !== "producer") return json(res, 403, { error: "Цены подают только предприятия" }), true;
    const b = await readJson(req);
    const crop = isCrop(b.crop) ? b.crop : null;
    if (!crop || !me.crops.includes(crop)) return json(res, 400, { error: "Эта культура не закреплена за вами. Обратитесь к менеджеру" }), true;
    const price = Math.round(Number(b.price));
    const volume = Math.round(Number(b.volume));
    const now = Date.now();
    const today = mskDay(now);
    const todayQuotes = quotes.ofDay(today, crop);
    const latest = latestAccepted(todayQuotes);
    const mine = latest.get(me.id);
    const ref = referenceInfo(latest, me.regionId, me.id);
    const check = checkQuote(price, volume, { reference: ref?.price, previous: mine?.price ?? quotes.lastAcceptedBefore(me.id, today, crop)?.price });
    if (check.level === "reject" || check.suggestion) {
      return json(res, 400, { error: check.issues.map((i) => i.message).join(" ") }), true;
    }
    if (check.level === "confirm" && b.confirm !== true) {
      return json(res, 200, { needConfirm: true, issues: check.issues.map((i) => i.message) }), true;
    }
    const q = quotes.insert(
      {
        crop,
        companyId: me.id,
        regionId: me.regionId,
        price,
        volume,
        at: now,
        status: check.moderation ? "moderation" : "accepted",
        revision: todayQuotes.filter((x) => x.companyId === me.id && x.status === "accepted").length + 1,
        prevPrice: mine?.price,
        note: check.moderation ? "Отклонение от медианы — ручная проверка" : undefined,
      },
      "web"
    );
    publishQuote(q);
    onQuote(q);
    if (check.moderation) notifyAdmin(`🔎 Цена на проверку: ${me.name} · ${CROP_BY_ID[crop].name} · ${rub(price)} ₽/т · ${rub(volume)} т`);
    return json(res, 200, { ok: true, moderation: check.moderation, account: profile(companies.get(me.id)!) }), true;
  }

  // ── Покупатель: заявки в стакан ──
  if (req.method === "POST" && path === "/api/cabinet/bids") {
    if (me.role === "producer") return json(res, 403, { error: "Заявки на покупку ставят экспортёры и агенты" }), true;
    if (!allow(`bid:${me.id}`, 20)) return json(res, 429, { error: "Слишком много заявок подряд" }), true;
    const b = await readJson(req);
    const crop = isCrop(b.crop) ? b.crop : "flax";
    const price = Math.round(Number(b.price));
    const volume = Math.round(Number(b.volume));
    const regions = Array.isArray(b.regions) ? b.regions.filter((r: unknown) => typeof r === "string" && isRegionId(r)) : [];
    const reference = latestAccepted(quotes.ofDay(mskDay(Date.now()), crop));
    const refIndex = [...reference.values()].map((q) => q.price).sort((a, z) => a - z);
    const err = checkBid(price, volume, refIndex.length ? refIndex[Math.floor(refIndex.length / 2)] : undefined);
    if (err) return json(res, 400, { error: err }), true;
    const bid = bids.insert({
      crop,
      price,
      volume,
      regions,
      buyer: me.role === "agent" ? "agent" : "exporter",
      name: me.name,
      contact: [me.person, me.phone, me.email].filter(Boolean).join(", "),
      ip,
      companyId: me.id,
    });
    notifyAdmin(`🟢 Заявка на покупку: ${me.name} (${ROLE_NAME[me.role]}) · ${CROP_BY_ID[crop].name} · ${rub(price)} ₽/т · ${rub(volume)} т. Проверьте в панели.`);
    return json(res, 200, { ok: true, bid, account: profile(me) }), true;
  }

  const cancel = path.match(/^\/api\/cabinet\/bids\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancel) {
    const bid = bids.get(cancel[1]);
    if (!bid || bid.companyId !== me.id) return json(res, 404, { error: "Заявка не найдена" }), true;
    const removed = bids.remove(bid.id);
    if (removed) publishBid(removed);
    return json(res, 200, { ok: true, account: profile(me) }), true;
  }

  // ── Сделка по цене из стакана: запрос менеджеру ──
  if (req.method === "POST" && path === "/api/cabinet/deal") {
    const b = await readJson(req);
    const side = b.side === "sell" ? "sell" : "buy";
    if (side === "sell" && me.role !== "producer") return json(res, 403, { error: "Продавать может только предприятие" }), true;
    if (side === "buy" && me.role === "producer") return json(res, 403, { error: "Покупают экспортёры и агенты" }), true;
    const crop = isCrop(b.crop) ? b.crop : "flax";
    const price = Math.round(Number(b.price));
    const volume = Math.round(Number(b.volume));
    if (!price || !volume) return json(res, 400, { error: "Укажите цену и объём" }), true;
    const what = side === "buy" ? "Хочет купить по цене предприятия" : "Хочет продать по цене покупателя";
    leads.insert({
      role: me.role,
      name: `${me.name} (${me.code})`,
      contact: [me.person, me.phone, me.email].filter(Boolean).join(", "),
      target: me.regionId,
      volume,
      comment: `${what}: ${rub(price)} ₽/т · ${CROP_BY_ID[crop].name}. ${clip(b.comment, 500)}`.trim(),
    });
    notifyAdmin(`🤝 Запрос на сделку: ${me.name} (${ROLE_NAME[me.role]}). ${what}: ${rub(price)} ₽/т · ${rub(volume)} т · ${CROP_BY_ID[crop].name}`);
    return json(res, 200, { ok: true }), true;
  }

  return json(res, 404, { error: "not found" }), true;
}
