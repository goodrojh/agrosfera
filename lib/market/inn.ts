// Проверка ИНН по контрольной сумме (алгоритм ФНС).
// 10 цифр — организация, 12 цифр — ИП и КФХ.

const W10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const W11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const W12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

const check = (digits: number[], weights: number[]) =>
  (weights.reduce((s, w, i) => s + w * digits[i], 0) % 11) % 10;

export function isValidInn(raw: string): boolean {
  const s = raw.replace(/\s/g, "");
  if (!/^\d{10}$|^\d{12}$/.test(s)) return false;
  const d = [...s].map(Number);
  if (d.length === 10) return check(d, W10) === d[9];
  return check(d, W11) === d[10] && check(d, W12) === d[11];
}
