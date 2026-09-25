"use client";

import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { login, register, type Role } from "@/lib/account";
import { CROPS, type CropId } from "@/lib/market/crops";
import { REGIONS, type RegionId } from "@/lib/market/regions";

export const field =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5A25]/15 focus:border-[#1F5A25]/40";

const ROLES: { id: Role; title: string; hint: string }[] = [
  { id: "producer", title: "Предприятие", hint: "продаю" },
  { id: "exporter", title: "Экспортёр", hint: "покупаю" },
  { id: "agent", title: "Агент", hint: "покупаю под заказ" },
];

const REGION_OPTIONS = [...REGIONS].sort((a, b) => a.name.localeCompare(b.name, "ru"));

/** Вход и регистрация в личный кабинет */
export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("producer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [regionId, setRegionId] = useState<RegionId | "">("");
  const [person, setPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [crops, setCrops] = useState<CropId[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Ссылка вида /kabinet/?role=exporter открывает регистрацию с выбранной ролью
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("role");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (r === "producer" || r === "exporter" || r === "agent") {
      setRole(r);
      setMode("register");
    } else if (p.has("register")) setMode("register");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      if (mode === "login") await login(email, password);
      else await register({ role, email, password, name, inn, regionId, person, phone, crops, comment });
    } catch (err) {
      setError((err as Error).message);
    }
    setSending(false);
  };

  const toggleCrop = (c: CropId) => setCrops((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  const reg = mode === "register";

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex bg-gray-100 p-1 rounded-xl" role="tablist">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => (setMode(m), setError(null))}
            className={"flex-1 py-2.5 text-sm rounded-lg transition-colors " + (mode === m ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-800")}
          >
            {m === "login" ? "Вход" : "Регистрация"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        {reg && (
          <>
            <p className="text-sm font-medium text-gray-700">Кто вы</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={
                    "rounded-xl border px-2 py-2.5 text-center transition-colors " +
                    (role === r.id ? "border-[#1F5A25] bg-[#f1f7ec] text-[#1F5A25]" : "border-gray-200 text-gray-700 hover:border-gray-300")
                  }
                >
                  <span className="block text-sm font-semibold">{r.title}</span>
                  <span className="block text-[11px] text-gray-500">{r.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-600 sm:col-span-2">
                {role === "producer" ? "Название предприятия" : "Название компании"}
                <input value={name} onChange={(e) => setName(e.target.value)} className={field + " mt-1"} placeholder="ООО «Нива»" />
              </label>
              <label className="text-sm text-gray-600">
                ИНН <span className="text-gray-400">— если есть</span>
                <input value={inn} onChange={(e) => setInn(e.target.value.replace(/\D/g, "").slice(0, 12))} inputMode="numeric" className={field + " mt-1 tabular-nums"} />
              </label>
              <label className="text-sm text-gray-600">
                Регион
                <select value={regionId} onChange={(e) => setRegionId(e.target.value as RegionId)} className={field + " mt-1"}>
                  <option value="">Выберите…</option>
                  {REGION_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-600">
                Контактное лицо
                <input value={person} onChange={(e) => setPerson(e.target.value)} className={field + " mt-1"} placeholder="Иван Петров" />
              </label>
              <label className="text-sm text-gray-600">
                Телефон
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={field + " mt-1"} placeholder="+7 900 000-00-00" />
              </label>
            </div>

            {role === "producer" && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Что продаёте</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CROPS.map((c) => {
                    const on = crops.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCrop(c.id)}
                        className={
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " +
                          (on ? "border-[#1F5A25] bg-[#1F5A25] text-white" : "border-gray-200 text-gray-700 hover:border-gray-300")
                        }
                      >
                        {on && <Check size={14} />} {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="my-5 border-t border-gray-100" />
          </>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={field + " mt-1"} placeholder="you@company.ru" />
          </label>
          <label className="text-sm text-gray-600">
            Пароль {reg && <span className="text-gray-400">— от 8 символов</span>}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={reg ? "new-password" : "current-password"}
              className={field + " mt-1"}
            />
          </label>
        </div>

        {reg && (
          <label className="mt-3 block text-sm text-gray-600">
            Комментарий <span className="text-gray-400">— необязательно</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className={field + " mt-1 resize-none"}
              placeholder={role === "producer" ? "Объёмы, склад, когда удобно звонить" : "Какие культуры и объёмы интересуют"}
            />
          </label>
        )}

        {error && <p className="mt-3 text-sm text-[#c0492f]">{error}</p>}

        <button type="submit" disabled={sending} className="mt-5 w-full rounded-xl bg-[#1F5A25] text-white py-3 font-semibold hover:bg-[#184a1d] disabled:opacity-60 transition-colors">
          {sending ? "Секунду…" : reg ? "Зарегистрироваться" : "Войти"}
        </button>
        <p className="mt-3 text-xs text-gray-400 text-center">
          {reg
            ? "После регистрации менеджер АгроСферы позвонит, проверит компанию и откроет доступ к инструменту."
            : "Забыли пароль? Напишите менеджеру — он выдаст временный."}
        </p>
      </form>
    </div>
  );
}
