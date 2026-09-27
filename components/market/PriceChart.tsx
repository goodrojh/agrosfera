"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeriesPoint } from "@/lib/market/aggregate";
import { dateShort, rub, time, tons } from "@/lib/market/format";

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: SeriesPoint[];
}

const PAD = { top: 16, right: 74, bottom: 28, left: 4 };
const TAG_H = 22;

/**
 * Плавная кривая без «перелётов» (монотонная кубическая интерполяция, Fritsch–Carlson):
 * линия проходит через каждую точку и не рисует выдуманных пиков между ними.
 */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (n === 1) return `M${f(pts[0][0])},${f(pts[0][1])}`;
  if (n === 2) return `M${f(pts[0][0])},${f(pts[0][1])}L${f(pts[1][0])},${f(pts[1][1])}`;
  const dx: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    s[i] = dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t: number[] = [s[0]];
  for (let i = 1; i < n - 1; i++) t[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  t[n - 1] = s[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / s[i];
    const b = t[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) {
      const tau = 3 / Math.sqrt(h);
      t[i] = tau * a * s[i];
      t[i + 1] = tau * b * s[i];
    }
  }
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += `C${f(x0 + h)},${f(y0 + t[i] * h)} ${f(x1 - h)},${f(y1 - t[i + 1] * h)} ${f(x1)},${f(y1)}`;
  }
  return d;
}

/** Значение ряда на момент t: последняя точка не позже t */
function valueAt(points: SeriesPoint[], t: number): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  for (const p of points) if (p.t <= t + 1) best = p;
  return best;
}

export default function PriceChart({ series, kind, animKey }: { series: ChartSeries[]; kind: "intraday" | "daily"; animKey: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 300 });
  const [hoverT, setHoverT] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(260, e.contentRect.width), h: Math.max(140, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawable = useMemo(() => series.filter((s) => s.points.length >= 2), [series]);
  const single = drawable.length === 1;

  const geo = useMemo(() => {
    if (!drawable.length) return null;
    const { w, h } = size;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const all = drawable.flatMap((s) => s.points);
    let lo = Math.min(...all.map((p) => p.index));
    let hi = Math.max(...all.map((p) => p.index));
    // Минимальный видимый размах — 4% цены, чтобы шум в пару сотен рублей не выглядел обвалом
    const padY = Math.max((hi - lo) * 0.18, (hi * 0.04 - (hi - lo)) / 2);
    lo -= padY;
    hi += padY;
    const t0 = Math.min(...all.map((p) => p.t));
    const t1 = Math.max(...all.map((p) => p.t));
    const span = Math.max(1, t1 - t0);
    const x = (t: number) => PAD.left + ((t - t0) / span) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;

    const lines = drawable.map((s) => {
      const d = smoothPath(s.points.map((p) => [x(p.t), y(p.index)]));
      const last = s.points[s.points.length - 1];
      return { ...s, d, last };
    });
    const bottom = (PAD.top + plotH).toFixed(1);
    const area = single ? `${lines[0].d}L${x(lines[0].last.t).toFixed(1)},${bottom}L${x(lines[0].points[0].t).toFixed(1)},${bottom}Z` : null;

    // Ценники справа: раздвигаем, чтобы не налезали друг на друга
    const tags = lines.map((l) => ({ id: l.id, color: l.color, value: l.last.index, y: y(l.last.index) - TAG_H / 2 })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < tags.length; i++) if (tags[i].y < tags[i - 1].y + TAG_H + 2) tags[i].y = tags[i - 1].y + TAG_H + 2;

    const ticksY = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
    const nX = w < 480 ? 3 : 5;
    const ticksX = Array.from({ length: nX }, (_, i) => t0 + (span * i) / (nX - 1));
    return { w, h, plotW, plotH, x, y, t0, span, lines, area, tags, ticksY, ticksX };
  }, [drawable, size, single]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const mx = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const t = geo.t0 + ((Math.min(Math.max(mx, PAD.left), PAD.left + geo.plotW) - PAD.left) / geo.plotW) * geo.span;
    setHoverT(t);
  };

  const fmtT = (t: number) => (kind === "intraday" ? time(t) : dateShort(t));
  const hover = geo && hoverT !== null ? geo.lines.map((l) => ({ ...l, p: valueAt(l.points, hoverT) })).filter((l) => l.p) : [];

  return (
    <div ref={wrapRef} className="relative w-full h-full select-none">
      {!geo ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 text-center px-6">
          Пока мало предложений — график появится, когда предприятия пришлют цены.
        </div>
      ) : (
        <svg width={geo.w} height={geo.h} className="absolute inset-0" onPointerMove={onMove} onPointerLeave={() => setHoverT(null)}>
          <defs>
            <linearGradient id="agr-area-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8CC152" stopOpacity={0.26} />
              <stop offset="100%" stopColor="#8CC152" stopOpacity={0} />
            </linearGradient>
          </defs>

          {geo.ticksY.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.y(v)} y2={geo.y(v)} stroke="#eef1ea" />
              {geo.tags.every((t) => Math.abs(t.y + TAG_H / 2 - geo.y(v)) > 16) && (
                <text x={geo.w - 6} y={geo.y(v) + 4} textAnchor="end" fontSize={12} fill="#8a9486" className="tabular-nums">
                  {rub(v)}
                </text>
              )}
            </g>
          ))}

          {geo.area && <path d={geo.area} fill="url(#agr-area-light)" />}
          {geo.lines.map((l) => (
            <motion.path
              key={`${animKey}-${l.id}`}
              d={l.d}
              fill="none"
              stroke={l.color}
              strokeWidth={single ? 2.5 : 2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: "easeInOut" as const }}
            />
          ))}

          {geo.lines.map((l) => (
            <circle key={l.id} cx={geo.x(l.last.t)} cy={geo.y(l.last.index)} r={4} fill={l.color} />
          ))}
          {single && <circle cx={geo.x(geo.lines[0].last.t)} cy={geo.y(geo.lines[0].last.index)} r={4.5} fill="#8CC152" className="agr-ping" />}

          {geo.tags.map((t) => (
            <g key={t.id} transform={`translate(${PAD.left + geo.plotW + 6}, ${t.y})`}>
              <rect width={PAD.right - 8} height={TAG_H} rx={6} fill={t.color} />
              <text x={(PAD.right - 8) / 2} y={15} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" className="tabular-nums">
                {rub(t.value)}
              </text>
            </g>
          ))}

          {hoverT !== null && (
            <g>
              <line x1={geo.x(hoverT)} x2={geo.x(hoverT)} y1={PAD.top} y2={PAD.top + geo.plotH} stroke="#c9d1c4" strokeDasharray="3 3" />
              {hover.map((l) => (
                <circle key={l.id} cx={geo.x(hoverT)} cy={geo.y(l.p!.index)} r={4.5} fill="#fff" stroke={l.color} strokeWidth={2.5} />
              ))}
            </g>
          )}

          {geo.ticksX.map((t, i) => (
            <text key={i} x={Math.min(Math.max(geo.x(t), PAD.left + 20), PAD.left + geo.plotW - 20)} y={geo.h - 6} textAnchor="middle" fontSize={12} fill="#8a9486">
              {fmtT(t)}
            </text>
          ))}
        </svg>
      )}

      {geo && hoverT !== null && hover.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-[#0f2413] text-white px-3.5 py-2.5 shadow-xl text-xs min-w-[170px]"
          style={{ left: Math.min(Math.max(geo.x(hoverT) - 85, 0), geo.w - 190), top: 4 }}
        >
          <p className="text-[11px] text-white/60 mb-1">{kind === "intraday" ? `сегодня в ${time(hoverT)}` : dateShort(hoverT)}</p>
          {hover.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex items-center gap-1.5 text-white/80">
                <span className="w-2 h-2 rounded-full" style={{ background: l.color === "#1F5A25" ? "#8CC152" : l.color }} />
                {l.label}
              </span>
              <span className="font-semibold tabular-nums">{rub(l.p!.index)} ₽/т</span>
            </div>
          ))}
          {hover.length === 1 && (
            <p className="text-[11px] text-white/60 mt-1">
              {hover[0].p!.count} предпр. · {tons(hover[0].p!.volume)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
