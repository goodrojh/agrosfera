// Демонстрационные данные для проверки сайта и панели (только на тестовой базе!):
//   DB_PATH=./data/test.db npx tsx src/seed-demo.ts
if (!process.env.DB_PATH || /agrosfera\.db$/.test(process.env.DB_PATH)) {
  console.error("Укажите DB_PATH тестовой базы — рабочую базу скрипт не трогает.");
  process.exit(1);
}

const { companies, quotes } = await import("./db.ts");
const { CROP_BY_ID } = await import("../../lib/market/crops.ts");
const { REGION_BY_ID } = await import("../../lib/market/regions.ts");
type RegionId = keyof typeof REGION_BY_ID;

const DAY = 86_400_000;
const now = Date.now();
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const r1 = (n: number) => Math.round(n * 10) / 10;

const PARTNERS: [string, RegionId, number][] = [
  ["Хозяйство «Колос»", "omsk", 0],
  ["СПК «Заря»", "altai", -0.02],
  ["ООО «Сибирское поле»", "novosibirsk", -0.01],
  ["КФХ Петрова", "kurgan", 0.01],
  ["ООО «Уралагро»", "chelyabinsk", 0.015],
  ["ООО «Степь»", "orenburg", 0.03],
  ["КФХ «Волжское»", "saratov", 0.05],
  ["ООО «Башагро»", "bashkortostan", 0.02],
  ["ООО «Амур-Агро»", "amur", 0.04],
  ["ООО «Кубань-Зерно»", "krasnodar", 0.08],
];

for (const [name, regionId, offset] of PARTNERS) {
  const c = companies.create({ name, regionId, status: "active", crops: ["flax", "sunflower"], person: "Иван Петров", phone: "+7 900 000-00-00", source: "admin" });
  for (const crop of ["flax", "sunflower"] as const) {
    const info = CROP_BY_ID[crop];
    const base = (crop === "flax" ? REGION_BY_ID[regionId].basePrice : info.basePrice) * (1 + offset);
    const moisture = 6 + rnd() * 4;
    const impurity = 0.5 + rnd() * 2;
    const quality = info.quality!.typical + (rnd() - 0.5) * 4;
    for (let d = 30; d >= 0; d--) {
      if (rnd() < 0.2) continue;
      const trend = 1 + 0.03 * Math.sin((30 - d) / 9) + (rnd() - 0.5) * 0.012;
      const at = now - d * DAY - (d === 0 ? rnd() * 3 * 3600_000 : (rnd() * 3 - 1) * 3600_000);
      if (at > now) continue;
      quotes.insert(
        {
          crop, companyId: c.id, regionId, at, status: "accepted", revision: 1,
          price: Math.round((base * trend) / 50) * 50,
          volume: Math.round((100 + rnd() * 600) / 10) * 10,
          moisture: r1(moisture + (rnd() - 0.5) * 0.6),
          impurity: r1(impurity + (rnd() - 0.5) * 0.4),
          quality: r1(quality + (rnd() - 0.5) * 0.6),
        },
        "telegram"
      );
    }
  }
}
// Анкета, ждущая проверки
companies.create({ name: "ООО «Новый Лён»", regionId: "krasnoyarsk", status: "new", crops: ["flax"], person: "Мария Смирнова", phone: "+7 913 000-00-00", source: "site" });
console.log("Готово: партнёров", PARTNERS.length);
export {};
