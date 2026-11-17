"use client";

import type { PhotoFilter } from "./types";

export interface FilterCounts {
  all: number;
  landscape: number;
  portrait: number;
  favorites: number;
}

export interface FilterBarProps {
  activeFilter: PhotoFilter;
  counts: FilterCounts;
  onFilterChange: (filter: PhotoFilter) => void;
}

export function FilterBar({
  activeFilter,
  counts,
  onFilterChange,
}: FilterBarProps) {
  const options: { filter: PhotoFilter; label: string; count: number }[] = [
    { filter: "all", label: "All", count: counts.all },
    { filter: "landscape", label: "Landscape", count: counts.landscape },
    { filter: "portrait", label: "Portrait", count: counts.portrait },
    { filter: "favorites", label: "★ Favorites", count: counts.favorites },
  ];

  return (
    <nav
      aria-label="Filter photos"
      className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar"
    >
      {options.map(({ filter, label, count }) => {
        const isActive = activeFilter === filter;
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onFilterChange(filter)}
            className={`shrink-0 px-3 py-1.5 transition-colors border text-xs ${
              isActive
                ? "bg-[var(--ink)] text-[var(--paper)] font-bold border-[var(--ink)] shadow-xs"
                : "bg-transparent text-[var(--quiet)] border-[var(--line)] hover:bg-[var(--ground)] hover:text-[var(--ink)]"
            }`}
          >
            <span>{label}</span>
            <span className="ml-1.5 font-mono tabular-nums opacity-85">
              ({count})
            </span>
          </button>
        );
      })}
    </nav>
  );
}
