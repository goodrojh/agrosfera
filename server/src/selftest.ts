// Прогон бота без Telegram/MAX: npm run selftest (временная БД в памяти)
process.env.DB_PATH = ":memory:";

const { companies } = await import("./db.ts");
const { handle, bus, beginRound } = await import("./core.ts");

const events: string[] = [];
bus.on("quote", (q) => events.push(`${q.crop}:${q.status}:${q.price}`));

// Рынок: три участника в Омской области уже работают
const peers = ["А", "Б", "В"].map((n) => companies.create({ name: `Хозяйство ${n}`, regionId: "omsk", crops: ["flax"], status: "active" }));
peers.forEach((p, i) => {
  handle({ channel: "telegram", userId: `peer${i}`, startPayload: p.inviteCode });
  handle({ channel: "telegram", userId: `peer${i}`, text: `${31000 + i * 200} 150` });
});

type Msg = Parameters<typeof handle>[0];
const say = (m: Msg) => {
  for (const out of handle(m)) {
    const btns = out.buttons?.length ? `\n[${out.buttons.map((b) => b.label).join("] [")}]` : "";
    console.log(`> ${m.text ?? m.button ?? m.phone ?? m.startPayload}\n${out.text}${btns}${out.requestContact ? "\n[📱 Отправить номер]" : ""}\n`);
  }
};
const u = { channel: "telegram" as const, userId: "new", userName: "Иван Петров", userHandle: "@ivan" };

console.log("=== Незнакомый пользователь пишет в бот ===");
say({ ...u, text: "31500 200" });

console.log("=== Анкета с сайта: карточка «новая» ===");
const card = companies.create({ name: "ООО «Тестовый Лён»", inn: "7707083893", regionId: "omsk", status: "new", crops: ["flax"], person: "Петров Иван", phone: "+7 913 123-45-67", source: "site" });
say({ ...u, phone: "89131234567" });

console.log("=== Менеджер поговорил, закрепил лён и подсолнечник, поставил галочку «Доступ открыт» ===");
companies.update(card.id, { status: "active", crops: ["flax", "sunflower"] });
say({ ...u, phone: "89131234567" });
say({ ...u, text: "30 150" });
say({ ...u, button: "b:confirm" });
say({ ...u, text: "нет" });

console.log("=== Утро следующего дня: бот сам присылает запрос ===");
for (const out of beginRound("telegram", "new", companies.get(card.id)!)) console.log(`${out.text}\n`);
say({ ...u, text: "31200 180" });
say({ ...u, text: "38500 300" });
say({ ...u, text: "/status" });
console.log("События для сайта:", events.join(", "));
export {};
