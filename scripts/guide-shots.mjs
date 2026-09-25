// Скриншоты для инструкции к терминалу (public/guide/*.png).
// 1) npm run build && python -m http.server 3100 --directory out
// 2) node scripts/guide-shots.mjs http://127.0.0.1:3100
// Нужен Microsoft Edge или Chrome (путь можно задать в BROWSER).

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");

async function open(path) {
  await send("Page.navigate", { url: base + path });
  await sleep(8000);
  await ev(`(() => {
    document.querySelector('video')?.remove();
    const s = document.createElement('style');
    s.textContent = '.guide-hl{outline:3px solid #f59e0b!important;outline-offset:6px;border-radius:14px;box-shadow:0 0 0 9999px rgba(15,36,19,.28)!important;position:relative;z-index:5}';
    document.head.appendChild(s);
    return true;
  })()`);
}

/** Подсветить элемент и снять область вокруг опорного блока */
async function shot(name, { highlight, area, pad = 16 }) {
  await ev(`document.querySelectorAll('.guide-hl').forEach(e => e.classList.remove('guide-hl')); true`);
  if (highlight) await ev(`(() => { const e = ${highlight}; if (e) e.classList.add('guide-hl'); return !!e; })()`);
  await sleep(600);
  const r = await ev(`(() => { const e = ${area}; const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`);
  const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 };
  const res = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
  writeFileSync(new URL(`${name}.png`, outDir), Buffer.from(res.data, "base64"));
  console.log("saved", name);
}

const card = `document.querySelector('#terminal .rounded-2xl.border')`;
const section = `document.querySelector('#terminal > div')`;

await open("/");
await ev(`document.getElementById('terminal').scrollIntoView(); true`);
await shot("1-crops", { highlight: `document.querySelector('nav[aria-label="Культура"]')`, area: section });
await shot("2-region", { highlight: `document.querySelector('#terminal [role=combobox]').closest('.flex.items-center.gap-2')`, area: card });
await shot("3-chart", { highlight: `document.querySelector('#terminal .px-5.pt-4')`, area: card });
await shot("4-book", { highlight: `document.querySelector('#terminal .border-t.border-gray-100')`, area: card });

// Карта: отметить два региона
await ev(`[...document.querySelectorAll('#terminal button')].find(b => b.textContent.includes('На карте')).click(); true`);
await sleep(900);
await ev(`(() => { for (const n of ['Омская обл.', 'Алтайский край']) document.querySelector('path[aria-label="' + n + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
await shot("5-map", { area: `document.querySelector('[aria-label="Выбор регионов на карте"] > div')`, pad: 0 });
await ev(`document.querySelector('[aria-label="Выбор регионов на карте"] [aria-label="Закрыть"]').click(); true`);
await sleep(500);

// Сделка по цене предприятия
await ev(`document.querySelector('#terminal button[title*="купить по этой цене"]').click(); true`);
await sleep(900);
await shot("6-deal", { area: `document.querySelector('[role=dialog] > div')`, pad: 0 });
await ev(`document.querySelector('[role=dialog] [aria-label="Закрыть"]').click(); true`);
await sleep(500);

// Своя заявка в стакан
await ev(`[...document.querySelectorAll('#terminal button')].find(b => b.textContent.includes('Поставить заявку')).click(); true`);
await sleep(900);
await ev(`(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const f = (ph, v) => { const i = [...document.querySelectorAll('[role=dialog] input')].find(x => x.placeholder === ph); set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); };
  f('30 000', '30500'); f('500', '800');
  return true;
})()`);
await sleep(400);
await shot("7-bid", { area: `document.querySelector('[role=dialog] > div')`, pad: 0 });

// Производителю: бот
await open("/sotrudnichestvo/");
await ev(`document.getElementById('bot').scrollIntoView(); true`);
await ev(`[...document.querySelectorAll('#bot button')].find(b => b.textContent.trim() === '31500 200').click(); true`);
await sleep(1800);
await shot("8-bot", { area: `document.querySelector('#bot .flex.flex-col.min-h-\\\\[520px\\\\]')`, pad: 0 });

ws.close();
spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"]);
console.log("готово");
