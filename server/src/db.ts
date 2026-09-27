import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { config, mskDay } from "./config.ts";
import type { Company, DailyClose, Quote, QuoteStatus } from "../../lib/market/types.ts";
import type { RegionId } from "../../lib/market/regions.ts";
import type { CropId } from "../../lib/market/crops.ts";

export type Channel = "telegram" | "max";

/** new — анкета с сайта ждёт проверки; active — доступ открыт; blocked — отключён */
export type CompanyStatus = "new" | "active" | "blocked";

/** Роль в базе: работаем только с предприятиями; exporter/agent — записи старой версии с личным кабинетом */
export type Role = "producer" | "exporter" | "agent";

export interface CompanyRow extends Company {
  role: Role;
  name: string;
  inn: string | null;
  inviteCode: string;
  status: CompanyStatus;
  active: boolean;
  /** Культуры, закреплённые за участником — по ним бот спрашивает цены */
  crops: CropId[];
  person: string | null;
  phone: string | null;
  telegram: string | null;
  notes: string;
  source: string;
  createdAt: number;
}

if (config.dbPath !== ":memory:") mkdirSync(dirname(config.dbPath), { recursive: true });
const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    inn TEXT,
    region_id TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS members (
    channel TEXT NOT NULL,
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL REFERENCES companies(id),
    name TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (channel, user_id)
  );
  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    region_id TEXT NOT NULL,
    price REAL NOT NULL,
    volume REAL NOT NULL,
    at INTEGER NOT NULL,
    day TEXT NOT NULL,
    status TEXT NOT NULL,
    revision INTEGER NOT NULL,
    prev_price REAL,
    note TEXT,
    source TEXT
  );
  CREATE INDEX IF NOT EXISTS quotes_day ON quotes(day);
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT, name TEXT, contact TEXT, target TEXT, volume REAL, comment TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    crop TEXT NOT NULL DEFAULT 'flax',
    price REAL NOT NULL,
    volume REAL NOT NULL,
    regions TEXT NOT NULL DEFAULT '[]',
    buyer TEXT,
    name TEXT,
    contact TEXT,
    ip TEXT,
    at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS reminders (day TEXT NOT NULL, company_id TEXT NOT NULL, PRIMARY KEY (day, company_id));
`);

// Миграции: колонки, добавленные после первой версии
for (const sql of [
  "ALTER TABLE bids ADD COLUMN buyer TEXT",
  "ALTER TABLE quotes ADD COLUMN crop TEXT NOT NULL DEFAULT 'flax'",
  "ALTER TABLE companies ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
  "ALTER TABLE companies ADD COLUMN crops TEXT NOT NULL DEFAULT '[\"flax\"]'",
  "ALTER TABLE companies ADD COLUMN person TEXT",
  "ALTER TABLE companies ADD COLUMN phone TEXT",
  "ALTER TABLE companies ADD COLUMN telegram TEXT",
  "ALTER TABLE companies ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN source TEXT NOT NULL DEFAULT 'admin'",
  "ALTER TABLE companies ADD COLUMN role TEXT NOT NULL DEFAULT 'producer'",
  "ALTER TABLE companies ADD COLUMN email TEXT",
  "ALTER TABLE companies ADD COLUMN password_hash TEXT",
  "ALTER TABLE bids ADD COLUMN company_id TEXT",
  "ALTER TABLE quotes ADD COLUMN moisture REAL",
  "ALTER TABLE quotes ADD COLUMN impurity REAL",
  "ALTER TABLE quotes ADD COLUMN quality REAL",
  "ALTER TABLE leads ADD COLUMN kind TEXT NOT NULL DEFAULT 'request'",
  "ALTER TABLE leads ADD COLUMN crop TEXT",
  "ALTER TABLE leads ADD COLUMN company TEXT",
  "ALTER TABLE leads ADD COLUMN phone TEXT",
  "ALTER TABLE leads ADD COLUMN price REAL",
  "ALTER TABLE leads ADD COLUMN offer_id TEXT",
  "ALTER TABLE leads ADD COLUMN offer TEXT",
  "ALTER TABLE leads ADD COLUMN seller_id TEXT",
  "ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new'",
  "ALTER TABLE leads ADD COLUMN note TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(sql);
  } catch {
    // колонка уже есть
  }
}
db.exec(`
  CREATE INDEX IF NOT EXISTS quotes_crop_day ON quotes(crop, day);
  CREATE INDEX IF NOT EXISTS quotes_crop_at ON quotes(crop, at);
`);

type Row = Record<string, string | number | null>;
const str = (v: string | number | null) => (v === null ? null : String(v));

/** Телефон для сравнения: последние 10 цифр (+7 913… и 8 913… — один номер) */
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-10);

const toCompany = (r: Row): CompanyRow => {
  const status = String(r.status ?? "active") as CompanyStatus;
  return {
    id: String(r.id),
    code: String(r.code),
    role: (["producer", "exporter", "agent"].includes(String(r.role)) ? String(r.role) : "producer") as Role,
    name: String(r.name),
    inn: str(r.inn),
    regionId: String(r.region_id) as RegionId,
    inviteCode: String(r.invite_code),
    status,
    active: status === "active",
    crops: JSON.parse(String(r.crops ?? '["flax"]')),
    person: str(r.person),
    phone: str(r.phone),
    telegram: str(r.telegram),
    notes: String(r.notes ?? ""),
    source: String(r.source ?? "admin"),
    createdAt: Number(r.created_at),
  };
};

const toQuote = (r: Row): Quote => ({
  id: String(r.id),
  crop: String(r.crop ?? "flax") as CropId,
  companyId: String(r.company_id),
  regionId: String(r.region_id) as RegionId,
  price: Number(r.price),
  volume: Number(r.volume),
  at: Number(r.at),
  status: String(r.status) as QuoteStatus,
  revision: Number(r.revision),
  prevPrice: r.prev_price === null ? undefined : Number(r.prev_price),
  note: r.note === null ? undefined : String(r.note),
  moisture: r.moisture === null || r.moisture === undefined ? undefined : Number(r.moisture),
  impurity: r.impurity === null || r.impurity === undefined ? undefined : Number(r.impurity),
  quality: r.quality === null || r.quality === undefined ? undefined : Number(r.quality),
});

export interface NewCompany {
  name: string;
  regionId: RegionId;
  inn?: string;
  status?: CompanyStatus;
  crops?: CropId[];
  person?: string;
  phone?: string;
  telegram?: string;
  notes?: string;
  source?: string;
}

export const companies = {
  list(): CompanyRow[] {
    return (db.prepare("SELECT * FROM companies ORDER BY created_at DESC").all() as Row[]).map(toCompany);
  },
  get(id: string): CompanyRow | undefined {
    const r = db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Row | undefined;
    return r && toCompany(r);
  },
  byCode(code: string): CompanyRow | undefined {
    const r = db.prepare("SELECT * FROM companies WHERE code = ?").get(code) as Row | undefined;
    return r && toCompany(r);
  },
  byInn(inn: string): CompanyRow | undefined {
    const r = db.prepare("SELECT * FROM companies WHERE inn = ?").get(inn) as Row | undefined;
    return r && toCompany(r);
  },
  byInvite(invite: string): CompanyRow | undefined {
    const r = db.prepare("SELECT * FROM companies WHERE invite_code = ?").get(invite.toUpperCase()) as Row | undefined;
    return r && toCompany(r);
  },
  /** Поиск карточки предприятия по телефону из анкеты (для подключения к боту) */
  byPhone(phone: string): CompanyRow | undefined {
    const key = phoneKey(phone);
    if (key.length < 10) return undefined;
    return this.list().find((c) => c.role === "producer" && c.phone && phoneKey(c.phone) === key);
  },
  create(input: NewCompany): CompanyRow {
    let code = "";
    do code = `П-${String(randomInt(100, 10000)).padStart(4, "0")}`;
    while (this.byCode(code));
    const invite = randomBytes(6).toString("base64url").replace(/[-_]/g, "X").slice(0, 8).toUpperCase();
    const id = randomUUID();
    const status = input.status ?? "active";
    db.prepare(
      `INSERT INTO companies (id, code, name, inn, region_id, invite_code, active, created_at, status, crops, person, phone, telegram, notes, source, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'producer')`
    ).run(
      id, code, input.name, input.inn ?? null, input.regionId, invite, status === "active" ? 1 : 0, Date.now(), status,
      JSON.stringify(input.crops ?? ["flax"]), input.person ?? null, input.phone ?? null, input.telegram ?? null, input.notes ?? "", input.source ?? "admin"
    );
    return this.get(id)!;
  },
  update(id: string, patch: Partial<Omit<NewCompany, "source">>): CompanyRow | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    const next = {
      name: patch.name ?? cur.name,
      inn: patch.inn ?? cur.inn,
      regionId: patch.regionId ?? cur.regionId,
      status: patch.status ?? cur.status,
      crops: patch.crops ?? cur.crops,
      person: patch.person ?? cur.person,
      phone: patch.phone ?? cur.phone,
      telegram: patch.telegram ?? cur.telegram,
      notes: patch.notes ?? cur.notes,
    };
    db.prepare(
      "UPDATE companies SET name = ?, inn = ?, region_id = ?, status = ?, active = ?, crops = ?, person = ?, phone = ?, telegram = ?, notes = ? WHERE id = ?"
    ).run(
      next.name, next.inn, next.regionId, next.status, next.status === "active" ? 1 : 0, JSON.stringify(next.crops),
      next.person, next.phone, next.telegram, next.notes, id
    );
    return this.get(id);
  },
  setActive(id: string, active: boolean) {
    this.update(id, { status: active ? "active" : "blocked" });
  },
  /** Для сайта: только предприятия с открытым доступом, без контактов */
  publicList(crop?: CropId): Company[] {
    return this.list()
      .filter((c) => c.role === "producer" && c.active && (!crop || c.crops.includes(crop)))
      .map(({ id, code, regionId }) => ({ id, code, regionId }));
  },
};

export const members = {
  get(channel: Channel, userId: string): { companyId: string; name: string | null } | undefined {
    const r = db.prepare("SELECT company_id, name FROM members WHERE channel = ? AND user_id = ?").get(channel, userId) as Row | undefined;
    return r && { companyId: String(r.company_id), name: str(r.name) };
  },
  link(channel: Channel, userId: string, companyId: string, name?: string) {
    db.prepare(
      "INSERT INTO members (channel, user_id, company_id, name, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(channel, user_id) DO UPDATE SET company_id = excluded.company_id, name = excluded.name"
    ).run(channel, userId, companyId, name ?? null, Date.now());
  },
  ofCompany(companyId: string): { channel: Channel; userId: string; name: string | null }[] {
    return (db.prepare("SELECT channel, user_id, name FROM members WHERE company_id = ?").all(companyId) as Row[]).map((r) => ({
      channel: String(r.channel) as Channel,
      userId: String(r.user_id),
      name: str(r.name),
    }));
  },
};

export const quotes = {
  insert(q: Omit<Quote, "id">, source: Channel | "admin" | "web"): Quote {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO quotes (id, crop, company_id, region_id, price, volume, at, day, status, revision, prev_price, note, source, moisture, impurity, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id, q.crop ?? "flax", q.companyId, q.regionId, q.price, q.volume, q.at, mskDay(q.at), q.status, q.revision, q.prevPrice ?? null, q.note ?? null, source,
      q.moisture ?? null, q.impurity ?? null, q.quality ?? null
    );
    return { ...q, id };
  },
  get(id: string): Quote | undefined {
    const r = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id) as Row | undefined;
    return r && toQuote(r);
  },
  setStatus(id: string, status: QuoteStatus, note?: string) {
    db.prepare("UPDATE quotes SET status = ?, note = ? WHERE id = ?").run(status, note ?? null, id);
  },
  ofDay(day: string, crop: CropId = "flax"): Quote[] {
    return (db.prepare("SELECT * FROM quotes WHERE day = ? AND crop = ? ORDER BY at").all(day, crop) as Row[]).map(toQuote);
  },
  /** Ответы по культуре начиная с момента since (без отклонённых) — для сводки и графика за день */
  since(since: number, crop: CropId): Quote[] {
    return (db.prepare("SELECT * FROM quotes WHERE crop = ? AND at >= ? AND status != 'rejected' ORDER BY at").all(crop, since) as Row[]).map(toQuote);
  },
  /** Отвечало ли предприятие начиная с момента since (любой ответ, в том числе «нет в продаже») */
  answeredSince(companyId: string, since: number): boolean {
    return !!db.prepare("SELECT 1 FROM quotes WHERE company_id = ? AND at >= ? LIMIT 1").get(companyId, since);
  },
  /** Время последнего ответа каждого предприятия */
  lastAnswers(): Map<string, number> {
    const rows = db.prepare("SELECT company_id, MAX(at) AS at FROM quotes GROUP BY company_id").all() as Row[];
    return new Map(rows.map((r) => [String(r.company_id), Number(r.at)]));
  },
  byStatus(status: QuoteStatus): Quote[] {
    return (db.prepare("SELECT * FROM quotes WHERE status = ? ORDER BY at DESC LIMIT 200").all(status) as Row[]).map(toQuote);
  },
  /** Дневные закрытия: последняя принятая цена предприятия за каждый прошлый день */
  history(today: string, crop: CropId = "flax", days = 90): DailyClose[] {
    const from = mskDay(Date.now() - days * 86_400_000);
    const rows = db
      .prepare(
        `SELECT q.day, q.company_id, q.region_id, q.price, q.volume FROM quotes q
         JOIN (SELECT company_id, day, MAX(at) AS at FROM quotes WHERE status = 'accepted' AND crop = ? AND day >= ? AND day < ? GROUP BY company_id, day) last
           ON last.company_id = q.company_id AND last.day = q.day AND last.at = q.at
         WHERE q.status = 'accepted' AND q.crop = ?`
      )
      .all(crop, from, today, crop) as Row[];
    return rows.map((r) => ({
      day: String(r.day),
      companyId: String(r.company_id),
      regionId: String(r.region_id) as RegionId,
      price: Number(r.price),
      volume: Number(r.volume),
    }));
  },
  lastAcceptedBefore(companyId: string, day: string, crop: CropId = "flax"): Quote | undefined {
    const r = db
      .prepare("SELECT * FROM quotes WHERE company_id = ? AND crop = ? AND status = 'accepted' AND day < ? ORDER BY at DESC LIMIT 1")
      .get(companyId, crop, day) as Row | undefined;
    return r && toQuote(r);
  },
};

export type LeadStatus = "new" | "working" | "done" | "rejected";

/** Заявка экспортёра: на конкретное предложение (offer) или общий запрос (request) */
export interface LeadRow {
  id: number;
  kind: "offer" | "request";
  crop: CropId | null;
  name: string;
  company: string;
  phone: string;
  /** Регион предложения или желаемые регионы */
  target: string;
  volume: number | null;
  price: number | null;
  /** Предложение на момент заявки: «Алтайский край · 36 900 ₽/т · 450 т · влажн. 8%…» */
  offer: string;
  /** Предприятие, чьё это предложение (видно только в панели) */
  sellerId: string | null;
  comment: string;
  status: LeadStatus;
  note: string;
  createdAt: number;
}

export type NewLead = Omit<LeadRow, "id" | "status" | "note" | "createdAt">;

const toLead = (r: Row): LeadRow => ({
  id: Number(r.id),
  kind: r.kind === "offer" ? "offer" : "request",
  crop: (str(r.crop) as CropId | null) ?? null,
  name: String(r.name ?? ""),
  company: String(r.company ?? ""),
  phone: String(r.phone ?? r.contact ?? ""),
  target: String(r.target ?? ""),
  volume: r.volume === null ? null : Number(r.volume),
  price: r.price === null || r.price === undefined ? null : Number(r.price),
  offer: String(r.offer ?? ""),
  sellerId: str(r.seller_id ?? null),
  comment: String(r.comment ?? ""),
  status: (String(r.status ?? "new") as LeadStatus),
  note: String(r.note ?? ""),
  createdAt: Number(r.created_at),
});

export const leads = {
  insert(l: NewLead): LeadRow {
    const res = db
      .prepare(
        "INSERT INTO leads (kind, crop, name, company, phone, contact, target, volume, price, offer, offer_id, seller_id, comment, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'buyer', ?)"
      )
      .run(l.kind, l.crop, l.name, l.company, l.phone, l.phone, l.target, l.volume, l.price, l.offer, null, l.sellerId, l.comment, Date.now());
    return this.get(Number(res.lastInsertRowid))!;
  },
  get(id: number): LeadRow | undefined {
    const r = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Row | undefined;
    return r && toLead(r);
  },
  recent(limit = 300): LeadRow[] {
    return (db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT ?").all(limit) as Row[]).map(toLead);
  },
  update(id: number, patch: { status?: LeadStatus; note?: string }) {
    const cur = this.get(id);
    if (!cur) return undefined;
    db.prepare("UPDATE leads SET status = ?, note = ? WHERE id = ?").run(patch.status ?? cur.status, patch.note ?? cur.note, id);
    return this.get(id);
  },
};

export const reminders = {
  /** true, если напоминание за этот день ещё не отправлялось */
  claim(day: string, companyId: string): boolean {
    const res = db.prepare("INSERT OR IGNORE INTO reminders (day, company_id) VALUES (?, ?)").run(day, companyId);
    return Number(res.changes) > 0;
  },
};
