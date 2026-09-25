export const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

export const tons = (n: number) => `${rub(n)} т`;

export function pct(x: number, digits = 1): string {
  const v = (x * 100).toFixed(digits).replace(".", ",");
  return x > 0 ? `+${v}%` : x < 0 ? v.replace("-", "−") + "%" : `${v}%`;
}

export const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export const dateShort = (ms: number) =>
  new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");

export const dateLong = (ms: number) =>
  new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s} с назад`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} мин назад`;
  return `${Math.round(m / 60)} ч назад`;
}
