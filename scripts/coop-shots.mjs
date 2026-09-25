// Скриншоты личного кабинета для страницы «Сотрудничество» (public/coop/*.webp).
// Нужны сайт, собранный с NEXT_PUBLIC_API_URL тестового сервера, и токены двух участников:
//   node scripts/coop-shots.mjs http://127.0.0.1:3001 tokens.json
// tokens.json: { "tp": "<токен предприятия>", "te": "<токен экспортёра>" }

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const { tp, te } = JSON.parse(readFileSync(process.argv[3] ?? "tokens.json", "utf8"));
const browser = process.env.BROWSER ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const outDir = new URL("../public/coop/", import.meta.url);
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
const ev = (expr) => send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });

await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");

async function shot(name, token, section) {
  await send("Page.navigate", { url: `${base}/kabinet/` });
  await sleep(2500);
  await ev(`localStorage.setItem('agr-token', ${JSON.stringify(token)}); true`);
  // Новый адрес (а не только #раздел) — чтобы страница загрузилась заново с этим токеном
  await send("Page.navigate", { url: `${base}/kabinet/?shot=${name}#${section}` });
  await sleep(6000);
  const { data } = await send("Page.captureScreenshot", { format: "webp", quality: 88 });
  writeFileSync(new URL(`${name}.webp`, outDir), Buffer.from(data, "base64"));
  console.log("ok", name);
}

try {
  await shot("terminal", te, "terminal");
  await shot("prices", tp, "prices");
  await shot("bids", te, "bids");
  await shot("matches", te, "matches");
} finally {
  ws.close();
  spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"]);
  // Профиль браузера занимает десятки мегабайт — не оставляем его во временной папке
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
