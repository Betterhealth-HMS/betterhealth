import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database, Role } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard — BetterHealth" };

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const roleHeading: Record<string, string> = {
  receptionist: "Reception Desk",
  nurse: "Triage & Nursing",
  doctor: "Doctor Consultation",
  lab_technician: "Laboratory",
  pharmacist: "Pharmacy",
  manager: "Management Overview",
  admin: "Administrator",
};

const statusBadge: Record<string, string> = {
  registered:   "bg-blue-50 text-blue-800 ring-blue-200",
  triage:       "bg-amber-50 text-amber-800 ring-amber-200",
  lab:          "bg-purple-50 text-purple-800 ring-purple-200",
  consultation: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pharmacy:     "bg-teal-50 text-teal-800 ring-teal-200",
  completed:    "bg-surface-container text-on-surface-variant ring-outline-variant",
  scheduled:    "bg-surface-container text-primary ring-outline-variant",
  confirmed:    "bg-blue-50 text-blue-800 ring-blue-200",
  arrived:      "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled:    "bg-red-50 text-red-800 ring-red-200",
  no_show:      "bg-red-50 text-red-800 ring-red-200",
};

const trendStyles = {
  up:       { card: "border-emerald-200", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
  neutral:  { card: "border-outline-variant", icon: "text-primary bg-primary-100", value: "text-on-surface-variant" },
  warning:  { card: "border-amber-200", icon: "text-amber-700 bg-amber-50", value: "text-amber-700" },
  critical: { card: "border-red-200", icon: "text-red-700 bg-red-50", value: "text-red-700" },
} as const;

const alertStyles = {
  critical: { bar: "bg-red-500",   badge: "bg-red-50 text-red-800 ring-red-200",     label: "Critical" },
  warning:  { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-200", label: "Warning" },
} as const;

type Trend = keyof typeof trendStyles;

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: userData },
    { data: todayVisitsRaw },
    { data: todayApptsRaw },
    { count: pendingRxCount },
    { data: inventoryRaw },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("visits")
      .select("id, visit_number, status, priority, registered_at, patients(full_name, patient_number)")
      .gte("registered_at", todayStart.toISOString())
      .not("status", "eq", "cancelled")
      .order("registered_at"),
    supabase
      .from("appointments")
      .select("id, appointment_number, scheduled_time, appointment_type, status, patients(full_name)")
      .eq("scheduled_date", todayStr)
      .order("scheduled_time"),
    supabase
      .from("prescriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("inventory")
      .select("item_name, current_stock, reorder_level, unit"),
  ]);

  const user = userData?.user;
  const { data: profileData } = user
    ? await supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
    : { data: null };
  const profile = profileData as Pick<ProfileRow, "full_name" | "role"> | null;
  const role = (profile?.role ?? "receptionist") as Role;

  const todayVisits = (todayVisitsRaw ?? []) as any[];
  const todayAppts  = (todayApptsRaw  ?? []) as any[];
  const inventory   = (inventoryRaw   ?? []) as any[];

  const activeVisits  = todayVisits.filter(v => v.status !== "completed");
  const completedToday = todayVisits.filter(v => v.status === "completed").length;
  const stageCounts = {
    registered:   activeVisits.filter(v => v.status === "registered").length,
    triage:       activeVisits.filter(v => v.status === "triage").length,
    lab:          activeVisits.filter(v => v.status === "lab").length,
    consultation: activeVisits.filter(v => v.status === "consultation").length,
    pharmacy:     activeVisits.filter(v => v.status === "pharmacy").length,
  };
  const emergencyCount = activeVisits.filter(v => v.priority === "emergency").length;
  const lowStockItems  = inventory.filter((i: any) => i.current_stock <= i.reorder_level);
  const pendingRx      = pendingRxCount ?? 0;
  const now            = Date.now();

  const longWaitVisits = activeVisits.filter((v: any) =>
    (now - new Date(v.registered_at).getTime()) / 60000 > 45
  );

  // ── Role-specific KPIs ──────────────────────────────────────────────────────
  type KPI = { label: string; value: number; change: string; trend: Trend };
  const kpis: KPI[] = (() => {
    const c = stageCounts;
    switch (role) {
      case "receptionist":
        return [
          { label: "Check-ins Today",      value: todayVisits.length, change: `${activeVisits.length} still active`, trend: "neutral" },
          { label: "Awaiting Triage",       value: c.registered, change: c.registered > 0 ? "Needs triage" : "Queue clear", trend: c.registered > 3 ? "warning" : "up" },
          { label: "Today's Appointments",  value: todayAppts.length, change: `${todayAppts.filter((a: any) => a.status === "scheduled").length} scheduled`, trend: "neutral" },
          { label: "Completed",             value: completedToday, change: "Visits concluded today", trend: "up" },
        ];
      case "nurse":
        return [
          { label: "Awaiting Triage",  value: c.registered, change: c.registered > 0 ? "Patients waiting" : "Queue clear", trend: c.registered > 2 ? "warning" : "up" },
          { label: "In Triage",        value: c.triage, change: "Currently triaging", trend: "neutral" },
          { label: "Active Visits",    value: activeVisits.length, change: `${emergencyCount} emergency`, trend: emergencyCount > 0 ? "critical" : "neutral" },
          { label: "Completed",        value: completedToday, change: "Today", trend: "up" },
        ];
      case "doctor":
        return [
          { label: "Ready for Consult",       value: c.triage + c.lab, change: "Awaiting consultation", trend: c.triage + c.lab > 2 ? "warning" : "neutral" },
          { label: "In Consultation",         value: c.consultation, change: "Currently active", trend: "neutral" },
          { label: "Pending Prescriptions",   value: pendingRx, change: "Awaiting dispensing", trend: pendingRx > 0 ? "warning" : "up" },
          { label: "Completed",               value: completedToday, change: "Today", trend: "up" },
        ];
      case "pharmacist":
        return [
          { label: "Pharmacy Queue",        value: c.pharmacy, change: "Awaiting dispensing", trend: c.pharmacy > 0 ? "warning" : "up" },
          { label: "Open Prescriptions",    value: pendingRx, change: "To dispense", trend: pendingRx > 0 ? "warning" : "up" },
          { label: "Low Stock Items",        value: lowStockItems.length, change: lowStockItems.length > 0 ? "Needs reorder" : "All adequate", trend: lowStockItems.length > 0 ? "warning" : "up" },
          { label: "Completed",              value: completedToday, change: "Dispensed today", trend: "up" },
        ];
      default: // manager / admin
        return [
          { label: "Patients Today",    value: todayVisits.length, change: `${activeVisits.length} still active`, trend: "neutral" },
          { label: "Active Queue",      value: activeVisits.length, change: `${emergencyCount} emergency`, trend: emergencyCount > 0 ? "critical" : "neutral" },
          { label: "Appointments",      value: todayAppts.length, change: `${todayAppts.filter((a: any) => a.status === "scheduled").length} pending`, trend: "neutral" },
          { label: "Alerts",            value: emergencyCount + lowStockItems.length, change: `${lowStockItems.length} low stock`, trend: (emergencyCount + lowStockItems.length) > 0 ? "warning" : "up" },
        ];
    }
  })();

  // ── Role-specific main panel visits ─────────────────────────────────────────
  const mainVisits: any[] = (() => {
    switch (role) {
      case "receptionist":   return activeVisits.filter((v: any) => v.status === "registered");
      case "nurse":          return activeVisits.filter((v: any) => ["registered", "triage"].includes(v.status));
      case "doctor":         return activeVisits.filter((v: any) => ["triage", "lab", "consultation"].includes(v.status));
      case "pharmacist":     return activeVisits.filter((v: any) => v.status === "pharmacy");
      case "lab_technician": return activeVisits.filter((v: any) => v.status === "lab");
      default:               return activeVisits;
    }
  })().slice(0, 10);

  const mainPanelTitle: Record<string, string> = {
    receptionist:   "Awaiting Triage",
    nurse:          "Triage Queue",
    doctor:         "Consultation Queue",
    pharmacist:     "Pharmacy Queue",
    lab_technician: "Lab Queue",
    manager:        "Active Visits",
    admin:          "Active Visits",
  };

  // ── Live alerts derived from real data ──────────────────────────────────────
  type Alert = { id: string; severity: "critical" | "warning"; message: string; time: string; link: string };
  const alerts: Alert[] = [
    ...activeVisits
      .filter((v: any) => v.priority === "emergency")
      .map((v: any) => ({
        id: `emg-${v.id}`,
        severity: "critical" as const,
        message: `Emergency: ${v.patients?.full_name ?? "Unknown patient"} — ${v.visit_number}`,
        time: new Date(v.registered_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        link: `/visits/${v.id}`,
      })),
    ...longWaitVisits.map((v: any) => {
      const waitMin = Math.floor((now - new Date(v.registered_at).getTime()) / 60000);
      return {
        id: `wait-${v.id}`,
        severity: (waitMin > 90 ? "critical" : "warning") as "critical" | "warning",
        message: `Long wait: ${v.patients?.full_name ?? "Patient"} — ${waitMin}m in ${v.status}`,
        time: new Date(v.registered_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        link: `/visits/${v.id}`,
      };
    }),
    ...lowStockItems.slice(0, 3).map((item: any) => ({
      id: `stock-${item.item_name}`,
      severity: (item.current_stock === 0 ? "critical" : "warning") as "critical" | "warning",
      message: `Low stock: ${item.item_name} (${item.current_stock} ${item.unit})`,
      time: "",
      link: "/inventory",
    })),
  ].slice(0, 8);

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">
            {roleHeading[role] ?? "Dashboard"}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{dateStr}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold ring-1 ring-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          System Live
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => {
          const t = trendStyles[kpi.trend];
          return (
            <div key={kpi.label} className={`rounded-lg border bg-white p-4 md:p-5 shadow-sm ${t.card}`}>
              <div className="flex items-start justify-between gap-2">
                <div className={`p-2 rounded-lg shrink-0 ${t.icon}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <span className={`text-2xl md:text-3xl font-bold tabular-nums font-mono ${t.value}`}>
                  {kpi.value}
                </span>
              </div>
              <p className="mt-3 text-xs md:text-sm font-semibold text-on-surface">{kpi.label}</p>
              <p className={`text-xs mt-0.5 ${t.value}`}>{kpi.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main panel: role-specific visit queue */}
        <div className="xl:col-span-2 rounded-lg border border-outline-variant bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
            <div>
              <h2 className="text-sm font-semibold text-on-surface">
                {mainPanelTitle[role] ?? "Active Visits"}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {mainVisits.length} patient{mainVisits.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link href="/queue" className="text-xs font-medium text-primary hover:underline">
              Open Queue →
            </Link>
          </div>

          {mainVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3 opacity-25">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <p className="text-sm font-medium">No patients in this queue</p>
              <p className="text-xs mt-1 opacity-70">
                {role === "receptionist"
                  ? "Check in a patient to get started."
                  : "Patients will appear here as they move through the system."}
              </p>
              {role === "receptionist" && (
                <Link href="/queue"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors">
                  Go to Queue
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low">
                    {["Visit #", "Patient", "Stage", "Wait", "Priority", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {mainVisits.map((v) => {
                    const isEmerg = v.priority === "emergency";
                    const waitMin = Math.floor((now - new Date(v.registered_at).getTime()) / 60000);
                    return (
                      <tr key={v.id} className={`transition-colors ${isEmerg ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-surface-container-low"}`}>
                        <td className="px-5 py-3 font-mono text-xs text-on-surface-variant whitespace-nowrap">{v.visit_number}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className="font-medium text-on-surface">{v.patients?.full_name ?? "—"}</p>
                          <p className="text-xs text-on-surface-variant font-mono">{v.patients?.patient_number}</p>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 capitalize ${statusBadge[v.status] ?? ""}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`text-xs font-mono font-semibold ${waitMin > 60 ? "text-red-700" : waitMin > 30 ? "text-amber-700" : "text-on-surface-variant"}`}>
                            {waitMin}m
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 capitalize ${
                            isEmerg ? "bg-red-50 text-red-800 ring-red-200" :
                            v.priority === "urgent" ? "bg-amber-50 text-amber-800 ring-amber-200" :
                            "bg-surface-container text-on-surface-variant ring-outline-variant"
                          }`}>
                            {v.priority}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <Link href={`/visits/${v.id}`} className="text-xs font-medium text-primary hover:underline">
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Today's appointments sub-section (receptionist / manager / admin) */}
          {["receptionist", "manager", "admin"].includes(role) && todayAppts.length > 0 && (
            <>
              <div className="px-5 py-3 border-t border-b border-outline-variant bg-surface-container-low">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Today&apos;s Appointments
                  </h3>
                  <Link href="/appointments" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-outline-variant">
                    {todayAppts.slice(0, 6).map((a: any) => (
                      <tr key={a.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className="font-medium text-on-surface">{a.patients?.full_name ?? "—"}</p>
                          <p className="text-xs text-on-surface-variant font-mono">{a.appointment_number}</p>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                          {a.scheduled_time?.slice(0, 5)}
                        </td>
                        <td className="px-5 py-3 text-xs text-on-surface-variant whitespace-nowrap capitalize">
                          {a.appointment_type?.replace(/_/g, " ")}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 capitalize ${statusBadge[a.status] ?? ""}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Live alerts panel */}
        <div className="rounded-lg border border-outline-variant bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
            <h2 className="text-sm font-semibold text-on-surface">Live Alerts</h2>
            <Link href="/reminders" className="text-xs font-medium text-primary hover:underline">
              All reminders →
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 mb-2 opacity-25">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-sm font-medium">No active alerts</p>
              <p className="text-xs mt-0.5 opacity-70">System running normally</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant">
              {alerts.map((alert) => {
                const s = alertStyles[alert.severity];
                return (
                  <div key={alert.id} className="flex gap-3 px-5 py-4">
                    <div className={`w-1 rounded-full shrink-0 ${s.bar}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${s.badge}`}>
                          {s.label}
                        </span>
                        {alert.time && (
                          <span className="text-xs text-on-surface-variant font-mono shrink-0">{alert.time}</span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface leading-relaxed">{alert.message}</p>
                      <Link href={alert.link} className="text-xs text-primary font-medium hover:underline mt-1 inline-block">
                        View →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
