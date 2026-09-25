// Прогон бота без Telegram/MAX: npm run selftest (временная БД в памяти)
process.env.DB_PATH = ":memory:";

const { companies } = await import("./db.ts");
const { handle, bus } = await import("./core.ts");
const { decideApplication, setApplicationNotifier } = await import("./registration.ts");

const events: string[] = [];
bus.on("quote", (q) => events.push(`${q.status}:${q.price}`));
let lastAppId = "";
setApplicationNotifier((a, existing) => {
  lastAppId = a.id;
  console.log(`[модератору] анкета: ${a.companyName}, ИНН ${a.inn}${existing ? ` (уже есть ${existing.code})` : ""}\n`);
});

// Рынок: три подтверждённых предприятия в Омской области (по приглашению)
const peers = ["А", "Б", "В"].map((n) => companies.create({ name: `Хозяйство ${n}`, regionId: "omsk" }));
peers.forEach((p, i) => {
  handle({ channel: "telegram", userId: `peer${i}`, startPayload: p.inviteCode });
  handle({ channel: "telegram", userId: `peer${i}`, text: `${31000 + i * 200} 150` });
});

type Msg = Parameters<typeof handle>[0];
const say = (m: Msg) => {
  for (const out of handle(m)) {
    const btns = out.buttons?.length ? `\n[${out.buttons.slice(0, 4).map((b) => b.label).join("] [")}${out.buttons.length > 4 ? "] …" : "]"}` : "";
    console.log(`> ${m.text ?? m.button ?? m.phone ?? m.startPayload}\n${out.text}${btns}${out.requestContact ? "\n[📱 Отправить номер]" : ""}\n`);
  }
};
const u = { channel: "telegram" as const, userId: "new", userName: "Иван Петров", userHandle: "@ivan" };

console.log("=== Неподтверждённый пользователь пытается прислать цену ===");
say({ ...u, text: "30 150" });
console.log("=== Анкета ===");
say({ ...u, button: "reg:start" });
say({ ...u, text: "ООО «Тестовый Лён»" });
say({ ...u, text: "7707083894" });
say({ ...u, text: "7707083893" });
say({ ...u, button: "reg:region:omsk" });
say({ ...u, text: "Петров Иван, директор" });
say({ ...u, phone: "+79131234567" });
say({ ...u, button: "reg:ok" });
console.log("=== Пока не подтвердили — цены не принимаются ===");
say({ ...u, text: "31500 200" });
console.log("=== Модератор подтверждает ===");
console.log(decideApplication(lastAppId, true)?.message.text, "\n");
console.log("=== Теперь предприятие присылает цену ===");
say({ ...u, text: "30 150" });
say({ ...u, button: "b:confirm" });
say({ ...u, text: "/status" });
console.log("События для сайта:", events.join(", "));
export {};
