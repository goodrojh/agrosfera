"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, X } from "lucide-react";
import type { IndexStats } from "@/lib/market/aggregate";
import { REGIONS, REGION_BY_ID, shortRegionName, type RegionId } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";

export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

/** Подпись выбранных регионов: «Все регионы», «Омская обл.», «3 региона: Омская, Алтайский…» */
export function regionsLabel(ids: RegionId[]): string {
  if (ids.length === 0) return "Все регионы";
  if (ids.length === 1) return REGION_BY_ID[ids[0]].name;
  const names = ids.slice(0, 2).map(shortRegionName).join(", ");
  return `${ids.length} ${plural(ids.length, ["регион", "региона", "регионов"])}: ${names}${ids.length > 2 ? "…" : ""}`;
}

/** Выбор нескольких регионов из списка с поиском */
export default function RegionPicker({
  value,
  onChange,
  stats,
  available,
}: {
  value: RegionId[];
  onChange: (ids: RegionId[]) => void;
  stats: Map<RegionId, IndexStats>;
  /** Регионы, где выращивают выбранную культуру */
  available?: RegionId[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REGIONS.filter(
      (r) => (!available || available.includes(r.id)) && (!q || r.name.toLowerCase().includes(q) || r.macro.toLowerCase().includes(q))
    );
  }, [query, available]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (id: RegionId) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const finish = () => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) toggle(options[active].id);
    } else if (e.key === "Escape") {
      finish();
    }
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-80">
      <div
        className={
          "flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-colors cursor-text " +
          (open ? "border-[#1F5A25] ring-2 ring-[#1F5A25]/10" : "border-gray-200 hover:border-gray-300")
        }
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <MapPin size={17} className="text-[#1F5A25] shrink-0" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={open ? query : ""}
          placeholder={open ? "Найти регион" : regionsLabel(value)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className={
            "flex-1 min-w-0 bg-transparent text-sm focus:outline-none " + (value.length && !open ? "placeholder:text-gray-900" : "placeholder:text-gray-500")
          }
        />
        {value.length > 0 ? (
          <button
            type="button"
            aria-label="Сбросить регионы"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={15} />
          </button>
        ) : (
          <ChevronDown size={17} className={"text-gray-400 transition-transform " + (open ? "rotate-180" : "")} />
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl">
          <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-72 overflow-y-auto py-1.5 agr-scroll">
            {options.map((r, i) => {
              const s = stats.get(r.id);
              const on = value.includes(r.id);
              return (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={on}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggle(r.id);
                  }}
                  className={"flex items-center gap-3 px-3 py-2 cursor-pointer " + (i === active ? "bg-gray-50" : "")}
                >
                  <span
                    className={
                      "w-4 h-4 shrink-0 rounded border flex items-center justify-center " +
                      (on ? "bg-[#1F5A25] border-[#1F5A25]" : "border-gray-300 bg-white")
                    }
                  >
                    {on && <Check size={12} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">{r.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-700 shrink-0">{s ? `${rub(s.index)} ₽` : "—"}</span>
                </li>
              );
            })}
            {options.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">Такого региона нет в базе</li>}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange([])} className="text-sm text-gray-500 hover:text-gray-800">
              Сбросить
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={finish}
              className="rounded-lg bg-[#1F5A25] text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-[#174a1c]"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
