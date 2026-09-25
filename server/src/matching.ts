// Поиск совпадений: покупатель готов заплатить не меньше цены предприятия.
// Совпадение сразу видит менеджер (панель + Telegram); стороны узнают, когда менеджер решит.

import { mskDay } from "./config.ts";
import { bids, companies, matches, quotes, type MatchRow } from "./db.ts";
import { latestAccepted } from "../../lib/market/aggregate.ts";
import { CROP_BY_ID, type CropId } from "../../lib/market/crops.ts";
import { REGION_BY_ID } from "../../lib/market/regions.ts";
import type { Quote } from "../../lib/market/types.ts";

const rub = (n: number) => Math.round(n).toLocaleString("ru-RU");

export let notifyMatch: (text: string) => void = () => {};
export function setMatchNotifier(fn: typeof notifyMatch) {
  notifyMatch = fn;
}

function announce(m: MatchRow) {
  const seller = companies.get(m.sellerCompanyId);
  const buyer = m.buyerCompanyId ? companies.get(m.buyerCompanyId) : undefined;
  const bid = bids.get(m.bidId);
  const buyerName = buyer ? `${buyer.name} (${buyer.role === "agent" ? "агент" : "экспортёр"})` : bid ? `${bid.buyer === "agent" ? "агент" : "экспортёр"}` : "покупатель";
  notifyMatch(
    `🔥 Совпадение цен · ${CROP_BY_ID[m.crop].name}\n` +
      `Покупатель ${buyerName} готов заплатить ${rub(m.bidPrice)} ₽/т за ${rub(m.bidVolume)} т\n` +
      `Предприятие ${seller?.name ?? m.sellerCompanyId} (${REGION_BY_ID[m.regionId].name}) продаёт по ${rub(m.askPrice)} ₽/т, ${rub(m.askVolume)} т\n` +
      `Разница в вашу пользу: ${rub(m.bidPrice - m.askPrice)} ₽/т. Откройте панель → «Совпадения».`
  );
}

/** Сверить заявки покупателей с сегодняшними ценами предприятий по культуре */
export function scanCrop(crop: CropId): MatchRow[] {
  const day = mskDay(Date.now());
  const asks = [...latestAccepted(quotes.ofDay(day, crop)).values()];
  const created: MatchRow[] = [];
  for (const bid of bids.activeWithOwner(crop)) {
    for (const ask of asks) {
      if (bid.price < ask.price) continue;
      if (bid.regions.length && !bid.regions.includes(ask.regionId)) continue;
      const m = matches.insertIfNew({
        crop,
        day,
        bidId: bid.id,
        buyerCompanyId: bid.companyId,
        sellerCompanyId: ask.companyId,
        regionId: ask.regionId,
        bidPrice: bid.price,
        askPrice: ask.price,
        bidVolume: bid.volume,
        askVolume: ask.volume,
      });
      if (m) {
        created.push(m);
        announce(m);
      }
    }
  }
  return created;
}

export const onQuote = (q: Quote) => (q.status === "accepted" ? scanCrop(q.crop ?? "flax") : []);
