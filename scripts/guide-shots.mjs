// Скриншоты для инструкции к сводке (public/guide/*.webp).
// 1) npm run build && python -m http.server 3100 --directory out
// 2) node scripts/guide-shots.mjs http://127.0.0.1:3100
// Нужен Microsoft Edge или Chrome (путь можно задать в BROWSER).

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const browser = process.env.BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outDir = new URL("../public/guide/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "edgecdp-"));
const proc = spawn(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 40 && !target; i++) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d.result);
    pending.delete(d.id);
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

await send("Emulation.setDeviceMetricsOverride", { width: 1180, height: 900, deviceScaleFactor: 2, mobile: false });
await send("Page.enable");

async function open(path) {
  await send("Page.navigate", { url: base + path });
  await sleep(8000);
  await ev(`(() => {
    document.querySelector('video')?.remove();
    const s = document.createElement('style');
    s.textContent = '.guide-hl{outline:3px solid #f59e0b!important;outline-offset:4px;border-radius:12px;position:relative;z-index:5}';
    document.head.appendChild(s);
    return true;
  })()`);
}

/** Подсветить элемент и снять крупно только нужный участок (area) — чтобы текст на скриншоте читался без лупы */
async function shot(name, { highlight, area, pad = 16 }) {
  await ev(`document.querySelectorAll('.guide-hl').forEach(e => e.classList.remove('guide-hl')); true`);
  if (highlight) await ev(`(() => { const e = ${highlight}; if (e) e.classList.add('guide-hl'); return !!e; })()`);
  await sleep(600);
  const r = await ev(`(() => {
    const list = [].concat(${area}).filter(Boolean).map((e) => e.getBoundingClientRect());
    const x = Math.min(...list.map((b) => b.left)), y = Math.min(...list.map((b) => b.top));
    const w = Math.max(...list.map((b) => b.right)) - x, h = Math.max(...list.map((b) => b.bottom)) - y;
    return { x: x + scrollX, y: y + scrollY, w, h };
  })()`);
  const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 };
  const res = await send("Page.captureScreenshot", { format: "webp", quality: 88, clip, captureBeyondViewport: true });
  writeFileSync(new URL(`${name}.webp`, outDir), Buffer.from(res.data, "base64"));
  console.log("saved", name);
}

const card = `document.querySelector('#terminal .rounded-2xl.border')`;
const cardHead = `document.querySelector('#terminal .rounded-2xl.border > div')`;
const chart = `document.querySelector('#terminal .px-5.pt-4')`;
const offers = `document.querySelector('#terminal .px-5.pt-5')`;
const crops = `document.querySelector('nav[aria-label="Культура"]')`;
const clickText = (scope, text) => ev(`[...document.querySelectorAll('${scope} button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)})).click(); true`);
const fill = (values) =>
  ev(`(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [ph, v] of ${JSON.stringify(Object.entries(values))}) {
      const i = [...document.querySelectorAll('[role=dialog] input')].find(x => x.placeholder === ph);
      if (i) { set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    return true;
  })()`);

await open("/");
await ev(`document.getElementById('terminal').scrollIntoView(); true`);
await shot("1-crops", { highlight: crops, area: crops, pad: 20 });
// Выбор регионов — с открытым списком, чтобы было видно, как отмечать
await ev(`document.querySelector('#terminal [role=combobox]').parentElement.click(); true`);
await sleep(700);
await shot("2-region", { highlight: `document.querySelector('#terminal [role=combobox]').closest('.flex.items-center.gap-2')`, area: `[${cardHead}, document.querySelector('#terminal [role=listbox]')]`, pad: 12 });
await clickText("#terminal", "Готово");
await sleep(500);

// Таблица — пока выбраны все регионы: много строк, кадр близок к пропорциям окна инструкции
await shot("4-offers", { area: offers, pad: 8 });

// Карта: отметить три региона и применить — дальше график покажет три линии
await clickText("#terminal", "На карте");
await sleep(900);
await ev(`(() => { for (const n of ['Омская обл.', 'Алтайский край', 'Саратовская обл.']) document.querySelector('path[aria-label="' + n + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
await shot("5-map", { area: `document.querySelector('[aria-label="Выбор регионов на карте"] > div')`, pad: 0 });
await clickText('[aria-label="Выбор регионов на карте"]', "Применить");
await sleep(1500);

await clickText("#terminal", "Месяц");
// График для кадра повыше — линии регионов крупнее
await ev(`(() => { const box = [...document.querySelectorAll('#terminal div')].find((d) => d.className.includes('md:h-[230px]')); if (box) box.style.height = '430px'; return !!box; })()`);
await sleep(1800);
await shot("3-chart", { area: chart, pad: 8 });

// Заявка на предложение
await ev(`document.querySelector('#terminal table button').click(); true`);
await sleep(900);
await fill({ "Имя": "Алексей", "Телефон": "+7 900 123-45-67", "Компания": "ООО «Экспорт»" });
await sleep(400);
await shot("6-lead", { area: `document.querySelector('[role=dialog] > div')`, pad: 0 });
await ev(`document.querySelector('[role=dialog] [aria-label="Закрыть"]').click(); true`);
await sleep(500);

// Общий запрос
await clickText("#terminal", "Оставить запрос");
await sleep(900);
await fill({ "Имя": "Алексей", "Телефон": "+7 900 123-45-67" });
await sleep(400);
await shot("7-request", { area: `document.querySelector('[role=dialog] > div')`, pad: 0 });

// Предприятию: бот
await open("/predpriyatiyam/");
await ev(`document.getElementById('bot').scrollIntoView(); true`);
await clickText("#bot", "31500 200 8 1.5 46");
await sleep(1800);
await shot("8-bot", { area: `[...document.querySelectorAll('#bot div')].find((d) => d.className.includes('rounded-[44px]'))`, pad: 12 });

ws.close();
spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"]);
await sleep(500);
// Дочерние процессы браузера отпускают файлы не сразу — повторяем удаление профиля
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 });
} catch {}
console.log("готово");
