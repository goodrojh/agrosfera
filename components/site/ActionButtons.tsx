"use client";

import React from "react";
import { openPartner, openRequest } from "@/lib/actions";

/** Кнопка «Стать партнёром» — открывает анкету в окне на текущей странице */
export function PartnerButton({ className, children = "Стать партнёром" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={openPartner} className={className}>
      {children}
    </button>
  );
}

/** Кнопка «Оставить заявку» — открывает общую заявку в окне на текущей странице */
export function RequestButton({ className, children = "Оставить заявку" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={openRequest} className={className}>
      {children}
    </button>
  );
}
