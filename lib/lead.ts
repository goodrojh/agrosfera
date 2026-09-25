export type LeadRole = "exporter" | "agent" | "producer";

export const LEAD_EVENT = "agr-lead";

/** Прокрутить к форме заявки и выбрать роль */
export function openLead(role: LeadRole) {
  window.dispatchEvent(new CustomEvent<LeadRole>(LEAD_EVENT, { detail: role }));
  document.getElementById("zayavka")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
