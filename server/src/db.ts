import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { config, mskDay } from "./config.ts";
import type { Company, DailyClose, Quote, QuoteStatus } from "../../lib/market/types.ts";
import type { RegionId } from "../../lib/market/regions.ts";

export type Channel = "telegram" | "max";

export interface CompanyRow extends Company {
  name: string;
  inn: string | null;
  inviteCode: string;
  active: boolean;
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
  CREATE TABLE IF NOT EXISTS reminders (day TEXT NOT NULL, company_id TEXT NOT NULL, PRIMARY KEY (day, company_id));
`);

type Row = Record<string, string | number | null>;

const toCompany = (r: Row): CompanyRow => ({
  id: String(r.id),
  code: String(r.code),
  name: String(r.name),
  inn: r.inn === null ? null : String(r.inn),
  regionId: String(r.region_id) as RegionId,
  inviteCode: String(r.invite_code),
  active: Number(r.active) === 1,
});

const toQuote = (r: Row): Quote => ({
  id: String(r.id),
  companyId: String(r.company_id),
  regionId: String(r.region_id) as RegionId,
  price: Number(r.price),
  volume: Number(r.volume),
  at: Number(r.at),
  status: String(r.status) as QuoteStatus,
  revision: Number(r.revision),
  prevPrice: r.prev_price === null ? undefined : Number(r.prev_price),
  note: r.note === null ? undefined : String(r.note),
});

export const companies = {
  list(): CompanyRow[] {
    return (db.prepare("SELECT * FROM companies ORDER BY code").all() as Row[]).map(toCompany);
  },
  get(id: string): CompanyRow | undefined {
    const r = db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Row | undefined;
    return r && toCompany(r);
  },
  byCode(code: string): CompanyRow | undefined {
    const r = db.prepare("SELECT * FROM companies WHERE code = ?").get(code) as Row | undefined;
    return r && toCompany(r);
  },
  byInvite(invite: string): CompanyRow | undefined {
    const r = db.prepare("SELECT * FROM companies WHERE invite_code = ? AND active = 1").get(invite.toUpperCase()) as Row | undefined;
    return r && toCompany(r);
  },
  create(input: { name: string; regionId: RegionId; inn?: string }): CompanyRow {
    let code = "";
    do code = `П-${String(randomInt(100, 10000)).padStart(4, "0")}`;
    while (this.byCode(code));
    const invite = randomBytes(6).toString("base64url").replace(/[-_]/g, "X").slice(0, 8).toUpperCase();
    const id = randomUUID();
    db.prepare(
      "INSERT INTO companies (id, code, name, inn, region_id, invite_code, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)"
    ).run(id, code, input.name, input.inn ?? null, input.regionId, invite, Date.now());
    return this.get(id)!;
  },
  setActive(id: string, active: boolean) {
    db.prepare("UPDATE companies SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  },
  publicList(): Company[] {
    return this.list()
      .filter((c) => c.active)
      .map(({ id, code, regionId }) => ({ id, code, regionId }));
  },
};

export const members = {
  get(channel: Channel, userId: string): { companyId: string; name: string | null } | undefined {
    const r = db.prepare("SELECT company_id, name FROM members WHERE channel = ? AND user_id = ?").get(channel, userId) as Row | undefined;
    return r && { companyId: String(r.company_id), name: r.name === null ? null : String(r.name) };
  },
  link(channel: Channel, userId: string, companyId: string, name?: string) {
    db.prepare(
      "INSERT INTO members (channel, user_id, company_id, name, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(channel, user_id) DO UPDATE SET company_id = excluded.company_id, name = excluded.name"
    ).run(channel, userId, companyId, name ?? null, Date.now());
  },
  ofCompany(companyId: string): { channel: Channel; userId: string }[] {
    return (db.prepare("SELECT channel, user_id FROM members WHERE company_id = ?").all(companyId) as Row[]).map((r) => ({
      channel: String(r.channel) as Channel,
      userId: String(r.user_id),
    }));
  },
};

export const quotes = {
  insert(q: Omit<Quote, "id">, source: Channel | "admin"): Quote {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO quotes (id, company_id, region_id, price, volume, at, day, status, revision, prev_price, note, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, q.companyId, q.regionId, q.price, q.volume, q.at, mskDay(q.at), q.status, q.revision, q.prevPrice ?? null, q.note ?? null, source);
    return { ...q, id };
  },
  get(id: string): Quote | undefined {
    const r = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id) as Row | undefined;
    return r && toQuote(r);
  },
  setStatus(id: string, status: QuoteStatus, note?: string) {
    db.prepare("UPDATE quotes SET status = ?, note = ? WHERE id = ?").run(status, note ?? null, id);
  },
  ofDay(day: string): Quote[] {
    return (db.prepare("SELECT * FROM quotes WHERE day = ? ORDER BY at").all(day) as Row[]).map(toQuote);
  },
  /** Дневные закрытия: последняя принятая цена предприятия за каждый прошлый день */
  history(today: string, days = 90): DailyClose[] {
    const from = mskDay(Date.now() - days * 86_400_000);
    const rows = db
      .prepare(
        `SELECT q.day, q.company_id, q.region_id, q.price, q.volume FROM quotes q
         JOIN (SELECT company_id, day, MAX(at) AS at FROM quotes WHERE status = 'accepted' AND day >= ? AND day < ? GROUP BY company_id, day) last
           ON last.company_id = q.company_id AND last.day = q.day AND last.at = q.at
         WHERE q.status = 'accepted'`
      )
      .all(from, today) as Row[];
    return rows.map((r) => ({
      day: String(r.day),
      companyId: String(r.company_id),
      regionId: String(r.region_id) as RegionId,
      price: Number(r.price),
      volume: Number(r.volume),
    }));
  },
  lastAcceptedBefore(companyId: string, day: string): Quote | undefined {
    const r = db
      .prepare("SELECT * FROM quotes WHERE company_id = ? AND status = 'accepted' AND day < ? ORDER BY at DESC LIMIT 1")
      .get(companyId, day) as Row | undefined;
    return r && toQuote(r);
  },
};

export const leads = {
  insert(l: { role: string; name: string; contact: string; target: string; volume: number | null; comment: string }) {
    db.prepare("INSERT INTO leads (role, name, contact, target, volume, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      l.role, l.name, l.contact, l.target, l.volume, l.comment, Date.now()
    );
  },
};

export const reminders = {
  /** true, если напоминание за этот день ещё не отправлялось */
  claim(day: string, companyId: string): boolean {
    const res = db.prepare("INSERT OR IGNORE INTO reminders (day, company_id) VALUES (?, ?)").run(day, companyId);
    return Number(res.changes) > 0;
  },
};
