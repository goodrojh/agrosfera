"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeriesPoint } from "@/lib/market/aggregate";
import { dateShort, rub, time, tons } from "@/lib/market/format";

const LINE = "#A6D86C";
const PAD = { top: 18, right: 64, bottom: 26, left: 6 };

export default function PriceChart({
  points,
  kind,
  animKey,
}: {
  points: SeriesPoint[];
  kind: "intraday" | "daily";
  animKey: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 300 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.max(260, e.contentRect.width), h: Math.max(220, e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const { w, h } = size;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const priceH = plotH * 0.78;
    const volTop = PAD.top + plotH * 0.82;
    const volH = plotH * 0.18;
    if (points.length === 0) return null;

    const lows = points.map((p) => Math.min(p.index, p.p25));
    const highs = points.map((p) => Math.max(p.index, p.p75));
    let lo = Math.min(...lows);
    let hi = Math.max(...highs);
    const padY = Math.max((hi - lo) * 0.12, hi * 0.004);
    lo -= padY;
    hi += padY;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const span = Math.max(1, t1 - t0);
    const x = (t: number) => PAD.left + (points.length === 1 ? plotW / 2 : ((t - t0) / span) * plotW);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * priceH;
    const vMax = Math.max(...points.map((p) => p.volume), 1);

    const step = kind === "intraday";
    let line = "";
    points.forEach((p, i) => {
      const px = x(p.t).toFixed(1);
      const py = y(p.index).toFixed(1);
      if (i === 0) line += `M${px},${py}`;
      else if (step) line += `H${px}V${py}`;
      else line += `L${px},${py}`;
    });
    const last = points[points.length - 1];
    const area = `${line}L${x(last.t).toFixed(1)},${(PAD.top + priceH).toFixed(1)}L${x(t0).toFixed(1)},${(PAD.top + priceH).toFixed(1)}Z`;

    let band = "";
    if (!step && points.length > 1) {
      band = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.p75).toFixed(1)}`).join("");
      band += [...points].reverse().map((p) => `L${x(p.t).toFixed(1)},${y(p.p25).toFixed(1)}`).join("") + "Z";
    }

    const ticksY = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
    const nX = Math.min(points.length, w < 480 ? 3 : 5);
    const ticksX = Array.from({ length: nX }, (_, i) => t0 + (span * i) / Math.max(1, nX - 1));
    const barW = Math.max(1.5, Math.min(14, (plotW / Math.max(points.length, 1)) * 0.6));

    return { w, h, plotW, priceH, volTop, volH, x, y, vMax, line, area, band, ticksY, ticksX, last, barW };
  }, [points, size, kind]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(geo.x(p.t) - mx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;
  const fmtT = (t: number) => (kind === "intraday" ? time(t) : dateShort(t));

  return (
    <div ref={wrapRef} className="relative w-full h-full min-h-[240px] select-none">
      {!geo || points.length < 2 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
          {points.length === 1 ? "Первая подача за день — ждём остальных" : "Подач пока нет"}
        </div>
      ) : (
        <svg
          width={geo.w}
          height={geo.h}
          className="absolute inset-0"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="agr-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE} stopOpacity={0.28} />
              <stop offset="100%" stopColor={LINE} stopOpacity={0} />
            </linearGradient>
          </defs>

          {geo.ticksY.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.y(v)} y2={geo.y(v)} stroke="rgba(255,255,255,0.06)" />
              <text x={geo.w - 8} y={geo.y(v) + 4} textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.4)" className="tabular-nums">
                {rub(v)}
              </text>
            </g>
          ))}

          {points.map((p) => {
            const bh = (p.volume / geo.vMax) * geo.volH;
            return (
              <rect
                key={p.key}
                x={geo.x(p.t) - geo.barW / 2}
                y={geo.volTop + geo.volH - bh}
                width={geo.barW}
                height={bh}
                rx={1}
                fill="rgba(255,255,255,0.14)"
              />
            );
          })}

          {geo.band && <path d={geo.band} fill="rgba(166,216,108,0.10)" />}
          <path d={geo.area} fill="url(#agr-area)" />
          <motion.path
            key={animKey}
            d={geo.line}
            fill="none"
            stroke={LINE}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" as const }}
          />

          {/* Последняя цена — как в биржевом терминале */}
          <line
            x1={geo.x(geo.last.t)}
            x2={PAD.left + geo.plotW}
            y1={geo.y(geo.last.index)}
            y2={geo.y(geo.last.index)}
            stroke={LINE}
            strokeOpacity={0.5}
            strokeDasharray="3 4"
          />
          <g transform={`translate(${PAD.left + geo.plotW + 4}, ${geo.y(geo.last.index) - 10})`}>
            <rect width={PAD.right - 8} height={20} rx={5} fill={LINE} />
            <text x={(PAD.right - 8) / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0d2410" className="tabular-nums">
              {rub(geo.last.index)}
            </text>
          </g>
          <circle cx={geo.x(geo.last.t)} cy={geo.y(geo.last.index)} r={4} fill={LINE} />
          <circle cx={geo.x(geo.last.t)} cy={geo.y(geo.last.index)} r={4} fill={LINE} className="agr-ping" />

          {hp && (
            <g>
              <line x1={geo.x(hp.t)} x2={geo.x(hp.t)} y1={PAD.top} y2={geo.volTop + geo.volH} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
              <circle cx={geo.x(hp.t)} cy={geo.y(hp.index)} r={4.5} fill="#0d2410" stroke={LINE} strokeWidth={2} />
            </g>
          )}

          {geo.ticksX.map((t, i) => (
            <text
              key={i}
              x={Math.min(Math.max(geo.x(t), PAD.left + 18), PAD.left + geo.plotW - 18)}
              y={geo.h - 6}
              textAnchor="middle"
              fontSize={11}
              fill="rgba(255,255,255,0.4)"
            >
              {fmtT(t)}
            </text>
          ))}
        </svg>
      )}

      {hp && geo && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-white text-[#0d2410] px-3 py-2 shadow-2xl text-xs min-w-[150px]"
          style={{
            left: Math.min(Math.max(geo.x(hp.t) - 75, 0), geo.w - 160),
            top: Math.max(geo.y(hp.index) - 96, 0),
          }}
        >
          <p className="text-[10px] text-black/45">{kind === "intraday" ? `сегодня, ${time(hp.t)}` : dateShort(hp.t)}</p>
          <p className="text-sm font-bold tabular-nums">{rub(hp.index)} ₽/т</p>
          <p className="text-[11px] text-black/55 tabular-nums">
            {rub(hp.p25)}–{rub(hp.p75)} · {tons(hp.volume)}
          </p>
          <p className="text-[11px] text-black/55">предприятий: {hp.count}</p>
        </div>
      )}
    </div>
  );
}
