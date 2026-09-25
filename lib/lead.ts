import { BASE_PATH } from "./config";

export type LeadRole = "exporter" | "agent" | "producer";

/** Регистрация в личном кабинете с выбранной ролью */
export function openLead(role: LeadRole) {
  window.location.href = `${BASE_PATH}/kabinet/?role=${role}`;
}
