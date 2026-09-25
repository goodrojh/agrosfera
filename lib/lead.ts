import { BASE_PATH } from "./config";

export type LeadRole = "exporter" | "agent" | "producer";

export const LEAD_EVENT = "agr-lead";

/** К форме заявки с выбранной ролью. На главной формы нет — переходим на «Сотрудничество» */
export function openLead(role: LeadRole) {
  const form = document.getElementById("zayavka");
  if (!form) {
    window.location.href = `${BASE_PATH}/sotrudnichestvo/?role=${role}#zayavka`;
    return;
  }
  window.dispatchEvent(new CustomEvent<LeadRole>(LEAD_EVENT, { detail: role }));
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
