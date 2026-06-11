"use client";

import { useState, useTransition } from "react";
import { updateInventoryStock } from "@/app/actions/inventory";

interface Props {
  id: string;
  current: number;
  unit: string;
}

export default function StockUpdateForm({ id, current, unit }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const newStock = parseInt(value);
    if (isNaN(newStock) || newStock < 0) return;
    startTransition(async () => {
      await updateInventoryStock(id, newStock);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setValue(String(current)); setEditing(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          min={0}
          className="w-20 px-2 py-1 text-sm font-mono rounded border border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="p-1 rounded text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
          title="Save"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        <button
          onClick={() => { setValue(String(current)); setEditing(false); }}
          disabled={isPending}
          className="p-1 rounded text-on-surface-variant hover:bg-surface-container transition-colors"
          title="Cancel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setValue(String(current)); setEditing(true); }}
      className="group flex items-center gap-1 hover:bg-surface-container rounded px-1 -mx-1 transition-colors"
      title="Click to update stock"
    >
      <span className="font-bold font-mono tabular-nums">{current}</span>
      <span className="text-xs text-on-surface-variant">{unit}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}
