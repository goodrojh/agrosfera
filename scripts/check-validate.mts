import { parseSubmission, checkQuote } from "../lib/market/validate.ts";
const cases = ["32500 150","30 150","32 500 150","32 500 1 200","цена 32500, объем 150","32 500 руб 150 т","150 т 32500 руб","32,5 тыс 150","32.5к 200","31500\n200","31500; 200","31500/200","30000","привет","цена 31 тыс, объём 300 тонн","32500 150000","325000 150"];
for (const c of cases) { const p = parseSubmission(c); console.log(JSON.stringify(c).padEnd(34), JSON.stringify(p), p.ok ? checkQuote(p.price,p.volume,{reference:31500, previous: 31000}).level + " " + checkQuote(p.price,p.volume,{reference:31500}).issues.map(i=>i.code).join(",") + " sug=" + checkQuote(p.price,p.volume,{reference:31500}).suggestion : ""); }
console.log(checkQuote(45000,100,{reference:31500}));
