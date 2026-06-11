import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reminders — BetterHealth" };

type Reminder = {
  id: string;
  category: string;
  message: string;
  patient: string | null;
  dueLabel: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "overdue" | "pending" | "upcoming";
  link: string;
};

const priorityConfig = {
  critical: { cls: "bg-red-50 text-red-800 ring-red-200",       dot: "bg-red-500",   label: "Critical" },
  high:     { cls: "bg-amber-50 text-amber-800 ring-amber-200",  dot: "bg-amber-500", label: "High"     },
  medium:   { cls: "bg-blue-50 text-blue-800 ring-blue-200",     dot: "bg-blue-400",  label: "Medium"   },
  low:      { cls: "bg-surface-container text-on-surface-variant ring-outline-variant", dot: "bg-outline", label: "Low" },
};

const statusConfig = {
  overdue:  { cls: "bg-red-50 text-red-800 ring-red-200",            label: "Overdue"  },
  pending:  { cls: "bg-amber-50 text-amber-800 ring-amber-200",      label: "Pending"  },
  upcoming: { cls: "bg-surface-container text-primary ring-outline-variant", label: "Upcoming" },
};

export default async function RemindersPage() {
  const supabase = await createClient();

  const todayStr   = new Date().toISOString().split("T")[0];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = Date.now();

  const [{ data: visitsRaw }, { data: apptsRaw }, { data: inventoryRaw }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visit_number, status, priority, registered_at, patients(full_name)")
      .gte("registered_at", todayStart.toISOString())
      .not("status", "in", '("completed","cancelled")')
      .order("registered_at"),
    supabase
      .from("appointments")
      .select("id, appointment_number, scheduled_time, appointment_type, status, patients(full_name)")
      .eq("scheduled_date", todayStr)
      .eq("status", "scheduled")
      .order("scheduled_time"),
    supabase
      .from("inventory")
      .select("id, item_name, current_stock, reorder_level, unit"),
  ]);

  const visits   = (visitsRaw   ?? []) as any[];
  const appts    = (apptsRaw    ?? []) as any[];
  const inventory = (inventoryRaw ?? []) as any[];

  // ── Derive reminders from live data ─────────────────────────────────────────
  const reminders: Reminder[] = [];

  // 1. Patients waiting more than 45 minutes in any active stage
  for (const v of visits) {
    const waitMin = (now - new Date(v.registered_at).getTime()) / 60000;
    if (waitMin > 45) {
      reminders.push({
        id: `wait-${v.id}`,
        category: "Long Wait",
        message: `${v.patients?.full_name ?? "Patient"} has been in "${v.status}" for ${Math.floor(waitMin)} minutes`,
        patient: v.patients?.full_name ?? null,
        dueLabel: `${Math.floor(waitMin)}m ago`,
        priority: waitMin > 90 ? "critical" : waitMin > 60 ? "high" : "medium",
        status: "overdue",
        link: `/visits/${v.id}`,
      });
    }
  }

  // 2. Visits currently in pharmacy stage — need medication dispensed
  for (const v of visits.filter((v: any) => v.status === "pharmacy")) {
    reminders.push({
      id: `pharma-${v.id}`,
      category: "Medication",
      message: `Dispense prescription for ${v.patients?.full_name ?? "patient"} — ${v.visit_number}`,
      patient: v.patients?.full_name ?? null,
      dueLabel: "Pending dispense",
      priority: v.priority === "emergency" ? "critical" : "high",
      status: "pending",
      link: `/visits/${v.id}`,
    });
  }

  // 3. Emergency or urgent patients in queue
  for (const v of visits.filter((v: any) => v.priority === "emergency" && v.status !== "pharmacy")) {
    reminders.push({
      id: `emg-${v.id}`,
      category: "Emergency",
      message: `EMERGENCY: ${v.patients?.full_name ?? "Patient"} — ${v.visit_number} is in ${v.status}`,
      patient: v.patients?.full_name ?? null,
      dueLabel: "Immediate",
      priority: "critical",
      status: "overdue",
      link: `/visits/${v.id}`,
    });
  }

  // 4. Upcoming appointments in the next 90 minutes
  for (const a of appts) {
    if (!a.scheduled_time) continue;
    const [h, m] = (a.scheduled_time as string).split(":").map(Number);
    const apptDate = new Date();
    apptDate.setHours(h, m, 0, 0);
    const diffMin = (apptDate.getTime() - now) / 60000;
    if (diffMin > 0 && diffMin <= 90) {
      reminders.push({
        id: `appt-${a.id}`,
        category: "Appointment",
        message: `${a.patients?.full_name ?? "Patient"} appointment at ${a.scheduled_time.slice(0, 5)} — ${a.appointment_type?.replace(/_/g, " ") ?? "visit"}`,
        patient: a.patients?.full_name ?? null,
        dueLabel: `at ${a.scheduled_time.slice(0, 5)}`,
        priority: diffMin <= 15 ? "high" : "low",
        status: "upcoming",
        link: "/appointments",
      });
    }
  }

  // 5. Low stock and out-of-stock items
  const lowStock = inventory.filter((i: any) => i.current_stock <= i.reorder_level);
  for (const item of lowStock) {
    reminders.push({
      id: `stock-${item.id}`,
      category: "Inventory",
      message: `${item.item_name} is at ${item.current_stock} ${item.unit ?? "units"} — below reorder level of ${item.reorder_level}`,
      patient: null,
      dueLabel: item.current_stock === 0 ? "Out of stock" : "Low stock",
      priority: item.current_stock === 0 ? "critical" : "medium",
      status: item.current_stock === 0 ? "overdue" : "pending",
      link: "/inventory",
    });
  }

  // Sort: overdue first, then pending, then upcoming
  const statusOrder = { overdue: 0, pending: 1, upcoming: 2 };
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  reminders.sort((a, b) => {
    const sOrd = statusOrder[a.status] - statusOrder[b.status];
    if (sOrd !== 0) return sOrd;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const overdueCount  = reminders.filter(r => r.status === "overdue").length;
  const pendingCount  = reminders.filter(r => r.status === "pending").length;
  const upcomingCount = reminders.filter(r => r.status === "upcoming").length;

  const summaryStats = [
    { label: "Total Reminders", value: reminders.length,  color: "text-on-surface"  },
    { label: "Overdue",         value: overdueCount,       color: "text-red-700"     },
    { label: "Pending",         value: pendingCount,       color: "text-amber-700"   },
    { label: "Upcoming",        value: upcomingCount,      color: "text-primary"     },
  ];

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Reminders</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {overdueCount > 0
              ? `${overdueCount} overdue · ${pendingCount} pending today`
              : pendingCount > 0
              ? `${pendingCount} pending today`
              : "No active reminders"}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {summaryStats.map((s) => (
          <div key={s.label} className="rounded-lg border border-outline-variant bg-white px-5 py-4 shadow-sm">
            <p className={`text-2xl font-bold font-mono tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-red-700 shrink-0 mt-0.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {overdueCount} overdue reminder{overdueCount > 1 ? "s" : ""} require immediate attention
            </p>
            <p className="text-xs text-red-700 mt-0.5">Review the items below and take action.</p>
          </div>
        </div>
      )}

      {/* No reminders empty state */}
      {reminders.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-white p-12 flex flex-col items-center justify-center text-on-surface-variant shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4 opacity-25">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-sm font-medium">No active reminders</p>
          <p className="text-xs mt-1 opacity-70">
            Reminders are derived from the live queue, appointments, and inventory.
          </p>
        </div>
      ) : (
        /* Reminders table — desktop */
        <div className="rounded-lg border border-outline-variant bg-white overflow-hidden shadow-sm">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Category", "Message", "Patient", "Due", "Priority", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {reminders.map((r) => {
                  const pc = priorityConfig[r.priority];
                  const sc = statusConfig[r.status];
                  return (
                    <tr key={r.id} className={`transition-colors ${r.status === "overdue" ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-surface-container-low"}`}>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                          <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                          {r.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-on-surface max-w-72">
                        <p className="text-xs leading-relaxed">{r.message}</p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-xs font-medium text-on-surface">{r.patient ?? <span className="text-outline">—</span>}</p>
                      </td>
                      <td className={`px-5 py-3.5 font-mono text-xs whitespace-nowrap ${r.status === "overdue" ? "text-red-700 font-semibold" : "text-on-surface-variant"}`}>
                        {r.dueLabel}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${pc.cls}`}>
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Link href={r.link} className="text-xs font-medium text-primary hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-outline-variant">
            {reminders.map((r) => {
              const pc = priorityConfig[r.priority];
              const sc = statusConfig[r.status];
              return (
                <div key={r.id} className={`p-4 ${r.status === "overdue" ? "bg-red-50/30" : ""}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                      <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                      {r.category}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${sc.cls}`}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface leading-relaxed mb-2">{r.message}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${pc.cls}`}>
                        {pc.label}
                      </span>
                      <span className={`font-mono text-xs ${r.status === "overdue" ? "text-red-700 font-semibold" : "text-on-surface-variant"}`}>
                        {r.dueLabel}
                      </span>
                    </div>
                    <Link href={r.link} className="text-xs font-medium text-primary hover:underline">
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-low">
            <p className="text-xs text-on-surface-variant">
              {reminders.length} reminder{reminders.length !== 1 ? "s" : ""} derived from live queue, appointments &amp; inventory
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
