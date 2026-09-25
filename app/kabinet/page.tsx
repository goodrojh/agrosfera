"use client";

import React from "react";
import { cabinetAvailable, useAccount } from "@/lib/account";
import { asset } from "@/lib/config";
import AuthForm from "@/components/account/AuthForm";
import Cabinet from "@/components/account/Cabinet";

export default function CabinetPage() {
  const { loading, account } = useAccount();
  return (
    <main className="min-h-screen bg-[#f7f8f6]">
      <header className="bg-white border-b border-gray-200 px-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 py-3">
          <a href={asset("/")} className="flex items-center gap-2.5">
            <img src={asset("/brand/emblem.png")} alt="" className="h-8 w-8 rounded-full" />
            <span className="font-semibold tracking-[0.14em] text-sm text-gray-900">АГРОСФЕРА</span>
          </a>
          <nav className="flex items-center gap-5 text-sm text-gray-600">
            <a href={asset("/#terminal")} className="hover:text-gray-900">
              Котировки
            </a>
            <a href={asset("/sotrudnichestvo/")} className="hover:text-gray-900 hidden sm:inline">
              Сотрудничество
            </a>
          </nav>
        </div>
      </header>

      <div className="px-4 md:px-8 py-8 md:py-12">
        {!cabinetAvailable ? (
          <div className="max-w-lg mx-auto rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-lg font-semibold text-gray-900">Личный кабинет скоро откроется</p>
            <p className="mt-2 text-sm text-gray-600">Сейчас сайт работает в демо-режиме. Кабинет заработает, как только подключим сервер АгроСферы.</p>
          </div>
        ) : loading ? (
          <div className="h-60" />
        ) : account ? (
          <Cabinet account={account} />
        ) : (
          <>
            <div className="max-w-lg mx-auto text-center mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">Личный кабинет</h1>
              <p className="mt-2 text-gray-600">Подавайте цены, ставьте заявки и покупайте через АгроСферу — после проверки компании.</p>
            </div>
            <AuthForm />
          </>
        )}
      </div>
    </main>
  );
}
