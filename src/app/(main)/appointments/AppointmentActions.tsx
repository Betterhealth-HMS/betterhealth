"use client";

import { useTransition } from "react";
import { updateAppointmentStatus } from "@/app/actions/appointments";

interface Props {
  id: string;
  status: string;
}

export default function AppointmentActions({ id, status }: Props) {
  const [isPending, startTransition] = useTransition();

  function update(newStatus: string) {
    startTransition(() => updateAppointmentStatus(id, newStatus));
  }

  if (["completed", "cancelled", "no_show"].includes(status)) {
    return <span className="text-xs text-on-surface-variant italic">—</span>;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {status === "scheduled" && (
        <button
          onClick={() => update("confirmed")}
          disabled={isPending}
          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          Confirm
        </button>
      )}
      {status === "confirmed" && (
        <button
          onClick={() => update("arrived")}
          disabled={isPending}
          className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          Arrived
        </button>
      )}
      {status === "arrived" && (
        <button
          onClick={() => update("completed")}
          disabled={isPending}
          className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          Complete
        </button>
      )}
      <button
        onClick={() => update("cancelled")}
        disabled={isPending}
        className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
