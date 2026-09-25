// Прогон диалога бота без Telegram/MAX: npm run selftest (использует временную БД в памяти)
process.env.DB_PATH = ":memory:";

const { companies } = await import("./db.ts");
const { handle, bus } = await import("./core.ts");

const events: string[] = [];
bus.on("quote", (q) => events.push(`${q.status}:${q.price}`));

// Рынок: три предприятия в Омской области
const peers = ["А", "Б", "В"].map((n) => companies.create({ name: `Хозяйство ${n}`, regionId: "omsk" }));
peers.forEach((p, i) => {
  handle({ channel: "telegram", userId: `peer${i}`, startPayload: p.inviteCode });
  handle({ channel: "telegram", userId: `peer${i}`, text: `${31000 + i * 200} 150` });
});

const me = companies.create({ name: "ООО Тест", regionId: "omsk" });
const say = (m: Parameters<typeof handle>[0]) => {
  const out = handle(m);
  console.log(`> ${m.text ?? m.button ?? m.startPayload}\n${out.text}${out.buttons ? "\n[" + out.buttons.map((b) => b.label).join("] [") + "]" : ""}\n`);
};
const u = { channel: "telegram" as const, userId: "me" };
say({ ...u, text: "31500 200" });
say({ ...u, startPayload: me.inviteCode });
say({ ...u, text: "30 150" });
say({ ...u, button: "confirm" });
say({ ...u, text: "31200 180" });
say({ ...u, text: "48000 100" });
say({ ...u, button: "confirm" });
say({ ...u, text: "5000000 10" });
say({ ...u, text: "/status" });
console.log("События для сайта:", events.join(", "));
export {};
