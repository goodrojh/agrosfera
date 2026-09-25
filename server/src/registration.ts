// Подключение предприятия к боту через проверку.
// Незнакомый пользователь заполняет анкету (название, ИНН, регион, контакт) → анкета уходит
// модератору → только после «Подтвердить» бот начинает принимать от него цены.

import { applications, companies, members, type Application } from "./db.ts";
import { REGIONS, REGION_BY_ID, isRegionId, type RegionId } from "../../lib/market/regions.ts";
import { isValidInn } from "../../lib/market/inn.ts";
import { GREETING } from "../../lib/market/dialog.ts";
import type { Incoming, Outgoing } from "./core.ts";

type Step = "company" | "inn" | "region" | "person" | "phone" | "confirm";

interface Draft {
  step: Step;
  company?: string;
  inn?: string;
  regionId?: RegionId;
  person?: string;
  phone?: string;
}

const drafts = new Map<string, Draft>();

/** Уведомление модератору о новой анкете (подключает telegram.ts) */
export let notifyApplication: (a: Application, existing?: { code: string; name: string }) => void = () => {};
export function setApplicationNotifier(fn: typeof notifyApplication) {
  notifyApplication = fn;
}

const START: Outgoing = {
  text:
    "Бот АгроСферы принимает цены только от проверенных предприятий — так котировки остаются честными.\n\n" +
    "Чтобы подключиться, заполните короткую анкету (2 минуты). После проверки менеджером можно будет присылать цены.\n\n" +
    "Если менеджер прислал код приглашения — просто отправьте его сюда.",
  buttons: [{ id: "reg:start", label: "📝 Подключить предприятие" }],
};

const ASK: Record<Exclude<Step, "confirm">, Outgoing> = {
  company: { text: "1/5. Название предприятия — как в документах.\nНапример: ООО «Лён Сибири» или КФХ Иванов И. И." },
  inn: { text: "2/5. ИНН предприятия: 10 цифр для организации или 12 — для ИП и КФХ." },
  region: {
    text: "3/5. В каком регионе склад?",
    buttons: REGIONS.map((r) => ({ id: `reg:region:${r.id}`, label: r.name })),
  },
  person: { text: "4/5. Ваши ФИО и должность.\nНапример: Петров Иван, коммерческий директор" },
  phone: { text: "5/5. Телефон для связи — нажмите «Отправить номер» или напишите его.", requestContact: true },
};

function summary(d: Draft): Outgoing {
  return {
    text:
      "Проверьте анкету:\n\n" +
      `Предприятие: ${d.company}\nИНН: ${d.inn}\nРегион: ${REGION_BY_ID[d.regionId!].name}\nКонтакт: ${d.person}\nТелефон: ${d.phone}`,
    buttons: [
      { id: "reg:ok", label: "✅ Отправить на проверку" },
      { id: "reg:restart", label: "✏️ Заполнить заново" },
    ],
  };
}

/** Диалог с пользователем, который ещё не подтверждён как предприятие */
export function handleGuest(msg: Incoming): Outgoing[] {
  const key = `${msg.channel}:${msg.userId}`;

  const pending = applications.pendingFor(msg.channel, msg.userId);
  if (pending) {
    return [{ text: `Анкета предприятия ${pending.companyName} на проверке у менеджера АгроСферы. Как только подтвердим — пришлём сообщение, и можно будет присылать цены.` }];
  }

  if (msg.button === "reg:start" || msg.button === "reg:restart") {
    drafts.set(key, { step: "company" });
    return [ASK.company];
  }

  const d = drafts.get(key);
  if (!d) return [START];

  if (msg.button?.startsWith("reg:region:") && d.step === "region") {
    const id = msg.button.slice("reg:region:".length);
    if (!isRegionId(id)) return [ASK.region];
    d.regionId = id;
    d.step = "person";
    return [ASK.person];
  }

  if (msg.button === "reg:ok" && d.step === "confirm") {
    drafts.delete(key);
    const app = applications.insert({
      channel: msg.channel,
      userId: msg.userId,
      userName: msg.userName ?? null,
      userHandle: msg.userHandle ?? null,
      companyName: d.company!,
      inn: d.inn!,
      regionId: d.regionId!,
      person: d.person!,
      phone: d.phone!,
    });
    const existing = companies.byInn(app.inn);
    notifyApplication(app, existing && { code: existing.code, name: existing.name });
    return [{ text: "Анкета отправлена. Менеджер проверит предприятие и ответит здесь — обычно в течение рабочего дня." }];
  }

  const text = (msg.phone ?? msg.text ?? "").trim();
  switch (d.step) {
    case "company":
      if (text.length < 3 || !/[a-zа-яё]/i.test(text)) return [{ text: "Напишите название предприятия полностью." }, ASK.company];
      d.company = text.slice(0, 160);
      d.step = "inn";
      return [ASK.inn];
    case "inn": {
      const inn = text.replace(/\s/g, "");
      if (!isValidInn(inn)) return [{ text: "Такой ИНН не проходит проверку контрольной суммы. Проверьте цифры и отправьте ещё раз." }];
      d.inn = inn;
      d.step = "region";
      return [ASK.region];
    }
    case "region":
      return [ASK.region];
    case "person":
      if (text.length < 5) return [ASK.person];
      d.person = text.slice(0, 160);
      d.step = "phone";
      return [ASK.phone];
    case "phone": {
      const digits = text.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) return [{ text: "Не похоже на номер телефона. Пример: +7 913 123-45-67", requestContact: true }];
      d.phone = text.startsWith("+") ? text : `+${digits}`;
      d.step = "confirm";
      return [{ text: "Спасибо, номер записан.", removeKeyboard: true }, summary(d)];
    }
    case "confirm":
      return [summary(d)];
  }
}

/** Решение модератора. Возвращает анкету и сообщение для заявителя */
export function decideApplication(id: string, approve: boolean): { app: Application; message: Outgoing } | null {
  const app = applications.get(id);
  if (!app || app.status !== "pending") return null;

  if (!approve) {
    applications.decide(id, "rejected");
    return {
      app,
      message: { text: "К сожалению, анкету не удалось подтвердить. Если это ошибка — свяжитесь с менеджером АгроСферы." },
    };
  }

  // Второй сотрудник того же предприятия привязывается к уже существующей карточке
  const company = companies.byInn(app.inn) ?? companies.create({ name: app.companyName, regionId: app.regionId, inn: app.inn });
  members.link(app.channel, app.userId, company.id, app.person);
  applications.decide(id, "approved", company.id);
  return {
    app,
    message: { text: `✅ Предприятие ${company.name} подтверждено.\n\n${GREETING}` },
  };
}
