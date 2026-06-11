"use client";

import { useState, useTransition } from "react";
import { updateRoomStatus } from "@/app/actions/rooms";

const TRANSITIONS: Record<string, { label: string; next: string; cls: string }[]> = {
  ready:       [{ label: "Mark Occupied",  next: "occupied",    cls: "bg-blue-50 text-blue-700 hover:bg-blue-100" }],
  occupied:    [{ label: "Mark Cleaning",  next: "cleaning",    cls: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
                { label: "Maintenance",    next: "maintenance", cls: "bg-red-50 text-red-700 hover:bg-red-100" }],
  cleaning:    [{ label: "Mark Ready",     next: "ready",       cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" }],
  maintenance: [{ label: "Mark Ready",     next: "ready",       cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" }],
  reserved:    [{ label: "Mark Ready",     next: "ready",       cls: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
                { label: "Mark Occupied",  next: "occupied",    cls: "bg-blue-50 text-blue-700 hover:bg-blue-100" }],
};

interface Props {
  id: string;
  status: string;
}

export default function RoomStatusButton({ id, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const options = TRANSITIONS[status] ?? [];
  if (!options.length) return null;

  function update(next: string) {
    setOpen(false);
    startTransition(() => updateRoomStatus(id, next));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={isPending}
        className="text-xs px-2 py-1 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
      >
        {isPending ? "…" : "Update"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 bg-white rounded-lg border border-outline-variant shadow-lg min-w-max overflow-hidden">
            {options.map(opt => (
              <button
                key={opt.next}
                onClick={() => update(opt.next)}
                className={`block w-full text-left text-xs px-4 py-2 font-medium transition-colors ${opt.cls}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
