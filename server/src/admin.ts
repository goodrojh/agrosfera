// Управление участниками из консоли (основное — в панели управления /admin):
//   npm run admin -- add "ООО Лён Сибири" altai [ИНН] [культуры через запятую]
//   npm run admin -- list
//   npm run admin -- disable П-0412
//   npm run admin -- regions

import { config } from "./config.ts";
import { companies } from "./db.ts";
import { REGIONS, isRegionId } from "../../lib/market/regions.ts";
import { CROP_BY_ID, type CropId } from "../../lib/market/crops.ts";

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "add": {
    const [name, region, inn, cropsArg] = args;
    if (!name || !region || !isRegionId(region)) {
      console.log('Использование: npm run admin -- add "Название" <регион> [ИНН] [flax,sunflower]\nРегионы: npm run admin -- regions');
      process.exit(1);
    }
    const crops = (cropsArg ?? "flax").split(",").filter((c): c is CropId => c in CROP_BY_ID);
    const c = companies.create({ name, regionId: region, inn, crops, status: "active" });
    console.log(`Добавлено: ${c.name} → ${c.code}, культуры: ${crops.join(", ")}`);
    if (config.telegramUsername) console.log(`Ссылка для бота: https://t.me/${config.telegramUsername}?start=${c.inviteCode}`);
    break;
  }
  case "list":
    for (const c of companies.list()) console.log(`${c.code}  ${c.status.padEnd(7)}  ${c.name}  [${c.regionId}]  ${c.crops.join(",")}`);
    break;
  case "disable": {
    const c = companies.byCode(args[0]);
    if (!c) {
      console.log("Не найдено");
      process.exit(1);
    }
    companies.setActive(c.id, false);
    console.log(`Отключено: ${c.name}`);
    break;
  }
  case "regions":
    for (const r of REGIONS) console.log(`${r.id.padEnd(14)} ${r.name}`);
    break;
  default:
    console.log("Команды: add, list, disable, regions. Основное управление — панель /admin");
}
