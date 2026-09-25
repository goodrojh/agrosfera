"use client";

// Личный кабинет: токен сессии, запросы к API и состояние аккаунта для всех компонентов.

import { useSyncExternalStore } from "react";
import { API_URL, BASE_PATH } from "./config";
import type { CropId } from "./market/crops";
import type { RegionId } from "./market/regions";

export type Role = "producer" | "exporter" | "agent";
export type AccountStatus = "new" | "active" | "blocked";
export type MatchStatus = "new" | "working" | "done" | "rejected";

export const ROLE_LABEL: Record<Role, string> = { producer: "Предприятие", exporter: "Экспортёр", agent: "Агент" };

export interface AccountBid {
  id: string;
  crop?: CropId;
  price: number;
  volume: number;
  regions: RegionId[];
  at: number;
  status: "pending" | "active" | "removed";
}

export interface Account {
  id: string;
  code: string;
  role: Role;
  status: AccountStatus;
  email: string | null;
  name: string;
  inn: string | null;
  regionId: RegionId;
  person: string | null;
  phone: string | null;
  crops: CropId[];
  botConnected: boolean;
  botLink: string | null;
  quotesToday: { crop: CropId; price: number | null; volume: number | null; at: number | null }[];
  bids: AccountBid[];
  matches: { id: string; crop: CropId; side: "buy" | "sell"; price: number; volume: number; regionId: RegionId; status: MatchStatus; createdAt: number }[];
}

export interface RegisterInput {
  role: Role;
  email: string;
  password: string;
  name: string;
  inn: string;
  regionId: RegionId | "";
  person: string;
  phone: string;
  crops: CropId[];
  comment: string;
}

const KEY = "agr-token";
export const CABINET_URL = `${BASE_PATH}/kabinet/`;
export const cabinetAvailable = !!API_URL;

function readToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function writeToken(t: string | null) {
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* приватный режим — живём без сохранения */
  }
}

// ── Хранилище состояния ──
interface State {
  /** loading — ещё не знаем, вошёл ли пользователь */
  loading: boolean;
  account: Account | null;
}
let state: State = { loading: true, account: null };
let token: string | null = null;
let started = false;
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Запрос к API от имени вошедшего пользователя */
export async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Попробуйте ещё раз.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    token = null;
    writeToken(null);
    set({ account: null });
  }
  if (!res.ok) throw new ApiError(data.error ?? "Не удалось выполнить запрос", res.status);
  if (data.account) set({ account: data.account });
  return data as T;
}

export async function refreshAccount() {
  if (!cabinetAvailable || !token) return set({ loading: false, account: null });
  try {
    await api("/api/me");
  } catch {
    /* 401 уже сбросил токен; при обрыве связи оставляем прежнее состояние */
  }
  set({ loading: false });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  token = readToken();
  void refreshAccount();
  // Статус проверки и совпадения меняет менеджер — перечитываем, когда пользователь возвращается на вкладку
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && token) void refreshAccount();
  });
}

export async function login(email: string, password: string) {
  const r = await api<{ token: string }>("/api/auth/login", { email: email.trim(), password });
  token = r.token;
  writeToken(r.token);
}

export async function register(input: RegisterInput) {
  const r = await api<{ token: string }>("/api/auth/register", { ...input, email: input.email.trim() });
  token = r.token;
  writeToken(r.token);
}

export async function logout() {
  await api("/api/auth/logout", {}).catch(() => {});
  token = null;
  writeToken(null);
  set({ account: null });
}

const SERVER: State = { loading: true, account: null };

export function useAccount(): State {
  return useSyncExternalStore(
    (l) => {
      start();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER
  );
}
