"use client";

import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cabinetAvailable, useAccount } from "@/lib/account";
import { asset } from "@/lib/config";
import AuthForm from "@/components/account/AuthForm";
import CabinetApp from "@/components/account/CabinetApp";

const POINTS = [
  "Предприятие — подаёт цены на сайте и в боте, продаёт покупателям из стакана",
  "Экспортёр и агент — ставят заявки и покупают по ценам предприятий",
  "Сделку проводит АгроСфера — от проверки сторон до отгрузки",
];

export default function CabinetPage() {
  const { loading, account } = useAccount();

  if (cabinetAvailable && !loading && account) return <CabinetApp account={account} />;

  return (
    <main className="min-h-screen bg-[#f4f6f2] lg:grid lg:grid-cols-[minmax(360px,5fr)_7fr]">
      {/* Левая панель — бренд и что даёт кабинет */}
      <aside className="bg-[#0b1f0e] text-white px-6 md:px-10 py-6 lg:py-10 flex flex-col">
        <a href={asset("/")} className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white w-fit">
          <ArrowLeft size={15} /> На сайт
        </a>
        <div className="mt-6 lg:mt-auto flex items-center gap-3">
          <img src={asset("/brand/emblem.png")} alt="" className="h-11 w-11 rounded-full ring-1 ring-white/20" />
          <div>
            <p className="font-semibold tracking-[0.14em]">АГРОСФЕРА</p>
            <p className="text-xs text-white/50">личный кабинет участника</p>
          </div>
        </div>
        <h1 className="mt-6 text-[26px] md:text-[34px] font-semibold leading-tight tracking-tight max-w-md">Рабочее место для торговли агрокультурами</h1>
        <ul className="mt-6 space-y-3 max-w-md hidden sm:block">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-3 text-[15px] text-white/75">
              <Check size={18} className="text-[#8CC152] shrink-0 mt-0.5" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-8 lg:mt-auto text-xs text-white/35 hidden lg:block">Доступ открывается после проверки компании менеджером.</p>
      </aside>

      <section className="px-4 md:px-10 py-8 lg:py-16 flex items-start lg:items-center justify-center">
        {!cabinetAvailable ? (
          <div className="max-w-lg w-full rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-lg font-semibold text-gray-900">Личный кабинет скоро откроется</p>
            <p className="mt-2 text-sm text-gray-600">Сейчас сайт работает в демо-режиме. Кабинет заработает, как только подключим сервер АгроСферы.</p>
          </div>
        ) : loading ? (
          <div className="h-60" />
        ) : (
          <AuthForm />
        )}
      </section>
    </main>
  );
}
