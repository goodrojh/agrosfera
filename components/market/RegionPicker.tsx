"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, X } from "lucide-react";
import type { IndexStats } from "@/lib/market/aggregate";
import { REGIONS, REGION_BY_ID, type RegionId } from "@/lib/market/regions";
import { rub } from "@/lib/market/format";

export default function RegionPicker({
  value,
  onChange,
  stats,
  available,
}: {
  value: RegionId | null;
  onChange: (id: RegionId | null) => void;
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
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (id: RegionId | null) => {
    onChange(id);
    setQuery("");
    setOpen(false);
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
      if (options[active]) choose(options[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-96">
      <div
        className={
          "flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-colors " +
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
          value={open ? query : value ? REGION_BY_ID[value].name : ""}
          placeholder={value ? REGION_BY_ID[value].name : "Все регионы — введите название"}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        {value ? (
          <button
            type="button"
            aria-label="Сбросить регион"
            onClick={(e) => {
              e.stopPropagation();
              choose(null);
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
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-2 w-full max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl py-1.5"
        >
          {!query && (
            <li
              role="option"
              aria-selected={value === null}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(null);
              }}
              className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer text-gray-700 hover:bg-gray-50"
            >
              Все регионы
              {value === null && <Check size={15} className="text-[#1F5A25]" />}
            </li>
          )}
          {options.map((r, i) => {
            const s = stats.get(r.id);
            return (
              <li
                key={r.id}
                role="option"
                aria-selected={value === r.id}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r.id);
                }}
                className={"flex items-center justify-between gap-3 px-3 py-2 cursor-pointer " + (i === active ? "bg-[#f3f8ee]" : "")}
              >
                <span className="min-w-0">
                  <span className="block text-sm text-gray-900 truncate">{r.name}</span>
                  <span className="block text-[11px] text-gray-400">{r.macro}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-gray-800">{s ? `${rub(s.index)} ₽` : "—"}</span>
                  {value === r.id && <Check size={15} className="text-[#1F5A25]" />}
                </span>
              </li>
            );
          })}
          {options.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">Такого региона нет в базе</li>}
        </ul>
      )}
    </div>
  );
}
