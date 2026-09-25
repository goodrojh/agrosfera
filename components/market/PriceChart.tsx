"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeriesPoint } from "@/lib/market/aggregate";
import { dateShort, rub, time, tons } from "@/lib/market/format";

const LINE = "#1F5A25";
const PAD = { top: 16, right: 70, bottom: 28, left: 4 };

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
    if (points.length === 0) return null;
    const { w, h } = size;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;

    let lo = Math.min(...points.map((p) => p.index));
    let hi = Math.max(...points.map((p) => p.index));
    // Минимальный видимый размах — 4% цены, чтобы шум в пару сотен рублей не выглядел обвалом
    const padY = Math.max((hi - lo) * 0.2, (hi * 0.04 - (hi - lo)) / 2);
    lo -= padY;
    hi += padY;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const span = Math.max(1, t1 - t0);
    const x = (t: number) => PAD.left + (points.length === 1 ? plotW / 2 : ((t - t0) / span) * plotW);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;

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
    const bottom = (PAD.top + plotH).toFixed(1);
    const area = `${line}L${x(last.t).toFixed(1)},${bottom}L${x(t0).toFixed(1)},${bottom}Z`;

    const ticksY = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
    const nX = Math.min(points.length, w < 480 ? 3 : 5);
    const ticksX = Array.from({ length: nX }, (_, i) => t0 + (span * i) / Math.max(1, nX - 1));

    return { w, h, plotW, plotH, x, y, line, area, ticksY, ticksX, last };
  }, [points, size, kind]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const mx = e.clientX - e.currentTarget.getBoundingClientRect().left;
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
    <div ref={wrapRef} className="relative w-full h-full select-none">
      {!geo || points.length < 2 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 text-center px-6">
          Пока мало цен за сегодня — график появится, когда их пришлёт больше предприятий.
        </div>
      ) : (
        <svg width={geo.w} height={geo.h} className="absolute inset-0" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="agr-area-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8CC152" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#8CC152" stopOpacity={0} />
            </linearGradient>
          </defs>

          {geo.ticksY.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.y(v)} y2={geo.y(v)} stroke="#eef1ea" />
              {/* Подпись оси прячем, если она под ценником текущей цены */}
              {Math.abs(geo.y(v) - geo.y(geo.last.index)) > 16 && (
                <text x={geo.w - 6} y={geo.y(v) + 4} textAnchor="end" fontSize={12} fill="#8a9486" className="tabular-nums">
                  {rub(v)}
                </text>
              )}
            </g>
          ))}

          <path d={geo.area} fill="url(#agr-area-light)" />
          <motion.path
            key={animKey}
            d={geo.line}
            fill="none"
            stroke={LINE}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeInOut" as const }}
          />

          {/* Текущая цена */}
          <line
            x1={geo.x(geo.last.t)}
            x2={PAD.left + geo.plotW}
            y1={geo.y(geo.last.index)}
            y2={geo.y(geo.last.index)}
            stroke={LINE}
            strokeOpacity={0.35}
            strokeDasharray="3 4"
          />
          <g transform={`translate(${PAD.left + geo.plotW + 4}, ${geo.y(geo.last.index) - 11})`}>
            <rect width={PAD.right - 6} height={22} rx={6} fill={LINE} />
            <text x={(PAD.right - 6) / 2} y={15} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" className="tabular-nums">
              {rub(geo.last.index)}
            </text>
          </g>
          <circle cx={geo.x(geo.last.t)} cy={geo.y(geo.last.index)} r={4.5} fill={LINE} />
          <circle cx={geo.x(geo.last.t)} cy={geo.y(geo.last.index)} r={4.5} fill="#8CC152" className="agr-ping" />

          {hp && (
            <g>
              <line x1={geo.x(hp.t)} x2={geo.x(hp.t)} y1={PAD.top} y2={PAD.top + geo.plotH} stroke="#c9d1c4" strokeDasharray="3 3" />
              <circle cx={geo.x(hp.t)} cy={geo.y(hp.index)} r={5} fill="#fff" stroke={LINE} strokeWidth={2.5} />
            </g>
          )}

          {geo.ticksX.map((t, i) => (
            <text
              key={i}
              x={Math.min(Math.max(geo.x(t), PAD.left + 20), PAD.left + geo.plotW - 20)}
              y={geo.h - 6}
              textAnchor="middle"
              fontSize={12}
              fill="#8a9486"
            >
              {fmtT(t)}
            </text>
          ))}
        </svg>
      )}

      {hp && geo && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-[#0f2413] text-white px-3.5 py-2.5 shadow-xl text-xs min-w-[160px]"
          style={{
            left: Math.min(Math.max(geo.x(hp.t) - 80, 0), geo.w - 170),
            top: Math.max(geo.y(hp.index) - 92, 0),
          }}
        >
          <p className="text-[11px] text-white/60">{kind === "intraday" ? `сегодня в ${time(hp.t)}` : dateShort(hp.t)}</p>
          <p className="text-base font-bold tabular-nums">{rub(hp.index)} ₽/т</p>
          <p className="text-[11px] text-white/70">
            {hp.count} предпр. · {tons(hp.volume)}
          </p>
        </div>
      )}
    </div>
  );
}
