// Сборка контуров карты России для сайта: node scripts/build-map.mjs
// Источник границ: codeforgermany/click_that_hood (public/data/russia.geojson), упрощено mapshaper (6%).
import { readFileSync, writeFileSync } from "node:fs";
import { geoArea, geoConicEqualArea, geoPath } from "d3-geo";

const W = 1000;
const H = 560;
const geo = JSON.parse(readFileSync(new URL("./russia.simplified.geojson", import.meta.url), "utf8"));

// d3 ждёт обход колец по часовой стрелке (обратно RFC 7946). Если полигон «вывернут»
// (площадь больше полусферы) — разворачиваем кольца.
const reverseRings = (polys) => polys.map((rings) => rings.map((ring) => [...ring].reverse()));
for (const f of geo.features) {
  const g = f.geometry;
  const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const fixed = parts.map((poly) => (geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI ? reverseRings([poly])[0] : poly));
  g.coordinates = g.type === "Polygon" ? fixed[0] : fixed;
}

// Коническая равновеликая проекция — стандарт для карт России
const projection = geoConicEqualArea().rotate([-100, 0]).parallels([52, 64]).fitSize([W, H], geo);
const path = geoPath(projection).digits(1);

const regions = geo.features
  .map((f) => ({ name: f.properties.name, d: path(f) }))
  .filter((r) => r.d)
  .sort((a, b) => a.name.localeCompare(b.name, "ru"));

writeFileSync(
  new URL("../lib/market/russia-map.json", import.meta.url),
  JSON.stringify({ width: W, height: H, regions })
);
console.log(`регионов: ${regions.length}`);
