// Управление предприятиями из консоли:
//   npm run admin -- add "ООО Лён Сибири" altai [ИНН]
//   npm run admin -- list
//   npm run admin -- disable П-0412
//   npm run admin -- regions

import { config } from "./config.ts";
import { companies } from "./db.ts";
import { REGIONS, isRegionId } from "../../lib/market/regions.ts";

const [cmd, ...args] = process.argv.slice(2);

function links(invite: string): string {
  const out = [`  код приглашения: ${invite}`];
  if (config.telegramUsername) out.push(`  Telegram: https://t.me/${config.telegramUsername}?start=${invite}`);
  if (config.maxUsername) out.push(`  MAX:      https://max.ru/${config.maxUsername}?start=${invite}`);
  return out.join("\n");
}

switch (cmd) {
  case "add": {
    const [name, region, inn] = args;
    if (!name || !region || !isRegionId(region)) {
      console.log('Использование: npm run admin -- add "Название" <регион> [ИНН]\nРегионы: npm run admin -- regions');
      process.exit(1);
    }
    const c = companies.create({ name, regionId: region, inn });
    console.log(`Добавлено: ${c.name} → ${c.code}\n${links(c.inviteCode)}`);
    break;
  }
  case "list":
    for (const c of companies.list()) console.log(`${c.code}  ${c.active ? " " : "✕"}  ${c.name}  [${c.regionId}]  ${c.inviteCode}`);
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
    console.log("Команды: add, list, disable, regions");
}
