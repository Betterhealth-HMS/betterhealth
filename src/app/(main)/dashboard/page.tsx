import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database, Role } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard — BetterHealth" };

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const roleHeading: Record<string, string> = {
  receptionist:   "Reception",
  nurse:          "Nursing & Triage",
  doctor:         "Consultation",
  lab_technician: "Laboratory",
  pharmacist:     "Pharmacy",
  manager:        "Management",
  admin:          "Administration",
};

// Status badge styles — tight, precise
const stageBadge: Record<string, string> = {
  registered:   "bg-blue-50 text-blue-700 ring-blue-200/80",
  triage:       "bg-amber-50 text-amber-700 ring-amber-200/80",
  lab:          "bg-purple-50 text-purple-700 ring-purple-200/80",
  consultation: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  pharmacy:     "bg-teal-50 text-teal-700 ring-teal-200/80",
  completed:    "bg-slate-50 text-slate-500 ring-slate-200/80",
  scheduled:    "bg-slate-50 text-slate-600 ring-slate-200/80",
  confirmed:    "bg-blue-50 text-blue-700 ring-blue-200/80",
  arrived:      "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  cancelled:    "bg-red-50 text-red-600 ring-red-200/80",
  no_show:      "bg-red-50 text-red-600 ring-red-200/80",
};

const priorityBadge: Record<string, string> = {
  normal:    "bg-slate-50 text-slate-500 ring-slate-200/60",
  urgent:    "bg-amber-50 text-amber-700 ring-amber-200/80",
  emergency: "bg-red-50 text-red-700 ring-red-200/80",
};

type Trend = "up" | "neutral" | "warning" | "critical";

const trendConfig: Record<Trend, { bar: string; num: string; sub: string }> = {
  up:       { bar: "bg-emerald-500", num: "text-emerald-700", sub: "text-emerald-600" },
  neutral:  { bar: "bg-blue-500",    num: "text-slate-800",   sub: "text-slate-500"   },
  warning:  { bar: "bg-amber-500",   num: "text-amber-700",   sub: "text-amber-600"   },
  critical: { bar: "bg-red-500",     num: "text-red-700",     sub: "text-red-600"     },
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString().split("T")[0];

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
    supabase.from("prescriptions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("inventory").select("item_name, current_stock, reorder_level, unit"),
  ]);

  const user = userData?.user;
  const { data: profileData } = user
    ? await supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
    : { data: null };

  const profile = profileData as Pick<ProfileRow, "full_name" | "role"> | null;
  const role    = (profile?.role ?? "receptionist") as Role;

  const todayVisits = (todayVisitsRaw ?? []) as any[];
  const todayAppts  = (todayApptsRaw  ?? []) as any[];
  const inventory   = (inventoryRaw   ?? []) as any[];

  const activeVisits   = todayVisits.filter(v => v.status !== "completed");
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

  const longWaitVisits = activeVisits.filter(
    (v: any) => (now - new Date(v.registered_at).getTime()) / 60000 > 45
  );

  // KPIs per role
  type KPI = { label: string; value: string | number; sub: string; trend: Trend };
  const kpis: KPI[] = (() => {
    const c = stageCounts;
    switch (role) {
      case "receptionist":
        return [
          { label: "Check-ins Today",     value: todayVisits.length, sub: `${activeVisits.length} still active`,                         trend: "neutral"  },
          { label: "Awaiting Triage",      value: c.registered,       sub: c.registered > 0 ? "Patients waiting" : "Queue clear",         trend: c.registered > 3 ? "warning" : "up" },
          { label: "Appointments Today",   value: todayAppts.length,  sub: `${todayAppts.filter((a:any) => a.status === "scheduled").length} pending`, trend: "neutral"  },
          { label: "Completed",            value: completedToday,     sub: "Visits concluded",                                            trend: "up"       },
        ];
      case "nurse":
        return [
          { label: "Awaiting Triage", value: c.registered,       sub: c.registered > 0 ? "Patients waiting" : "Queue clear",          trend: c.registered > 2 ? "warning" : "up" },
          { label: "In Triage",       value: c.triage,           sub: "Currently triaging",                                           trend: "neutral"  },
          { label: "Active Visits",   value: activeVisits.length, sub: `${emergencyCount} emergency`,                                  trend: emergencyCount > 0 ? "critical" : "neutral" },
          { label: "Completed",       value: completedToday,     sub: "Today",                                                        trend: "up"       },
        ];
      case "doctor":
        return [
          { label: "Ready for Consult",     value: c.triage + c.lab, sub: "Awaiting consultation",  trend: c.triage + c.lab > 2 ? "warning" : "neutral" },
          { label: "In Consultation",       value: c.consultation,   sub: "Currently active",        trend: "neutral" },
          { label: "Pending Prescriptions", value: pendingRx,        sub: "Awaiting dispensing",     trend: pendingRx > 0 ? "warning" : "up" },
          { label: "Completed",             value: completedToday,   sub: "Today",                   trend: "up" },
        ];
      case "lab_technician":
        return [
          { label: "Lab Queue",     value: c.lab,             sub: "Awaiting processing",  trend: c.lab > 0 ? "warning" : "up" },
          { label: "Active Visits", value: activeVisits.length, sub: "Across all stages",  trend: "neutral" },
          { label: "Completed",     value: completedToday,    sub: "Today",                trend: "up" },
          { label: "Emergency",     value: emergencyCount,    sub: "High priority",        trend: emergencyCount > 0 ? "critical" : "up" },
        ];
      case "pharmacist":
        return [
          { label: "Pharmacy Queue",     value: c.pharmacy,         sub: "Awaiting dispensing",                                               trend: c.pharmacy > 0 ? "warning" : "up" },
          { label: "Open Prescriptions", value: pendingRx,          sub: "To dispense",                                                      trend: pendingRx > 0 ? "warning" : "up" },
          { label: "Low Stock Items",    value: lowStockItems.length, sub: lowStockItems.length > 0 ? "Needs reorder" : "All adequate",       trend: lowStockItems.length > 0 ? "warning" : "up" },
          { label: "Completed",         value: completedToday,      sub: "Dispensed today",                                                  trend: "up" },
        ];
      default:
        return [
          { label: "Patients Today",  value: todayVisits.length,   sub: `${activeVisits.length} still active`,   trend: "neutral" },
          { label: "Active Queue",    value: activeVisits.length,  sub: `${emergencyCount} emergency`,           trend: emergencyCount > 0 ? "critical" : "neutral" },
          { label: "Appointments",    value: todayAppts.length,    sub: `${todayAppts.filter((a:any) => a.status === "scheduled").length} pending`, trend: "neutral" },
          { label: "Alerts",          value: emergencyCount + lowStockItems.length, sub: `${lowStockItems.length} low stock`, trend: (emergencyCount + lowStockItems.length) > 0 ? "warning" : "up" },
        ];
    }
  })();

  // Role-specific main panel
  const mainVisits: any[] = (() => {
    switch (role) {
      case "receptionist":   return activeVisits.filter((v:any) => v.status === "registered");
      case "nurse":          return activeVisits.filter((v:any) => ["registered","triage"].includes(v.status));
      case "doctor":         return activeVisits.filter((v:any) => ["triage","lab","consultation"].includes(v.status));
      case "pharmacist":     return activeVisits.filter((v:any) => v.status === "pharmacy");
      case "lab_technician": return activeVisits.filter((v:any) => v.status === "lab");
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

  // Live alerts
  type Alert = { id: string; severity: "critical" | "warning"; message: string; time: string; link: string };
  const alerts: Alert[] = [
    ...activeVisits.filter((v:any) => v.priority === "emergency").map((v:any) => ({
      id: `emg-${v.id}`,
      severity: "critical" as const,
      message: `Emergency: ${v.patients?.full_name ?? "Unknown patient"} — ${v.visit_number}`,
      time: new Date(v.registered_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      link: `/visits/${v.id}`,
    })),
    ...longWaitVisits.map((v:any) => {
      const waitMin = Math.floor((now - new Date(v.registered_at).getTime()) / 60000);
      return {
        id: `wait-${v.id}`,
        severity: (waitMin > 90 ? "critical" : "warning") as "critical"|"warning",
        message: `Long wait: ${v.patients?.full_name ?? "Patient"} — ${waitMin}m in ${v.status}`,
        time: new Date(v.registered_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        link: `/visits/${v.id}`,
      };
    }),
    ...lowStockItems.slice(0, 3).map((item:any) => ({
      id: `stock-${item.item_name}`,
      severity: (item.current_stock === 0 ? "critical" : "warning") as "critical"|"warning",
      message: `Low stock: ${item.item_name} (${item.current_stock} ${item.unit} remaining)`,
      time: "",
      link: "/inventory",
    })),
  ].slice(0, 8);

  // Patient flow pipeline
  const pipeline = [
    { label: "Registered",   count: stageCounts.registered,   dot: "bg-blue-500"    },
    { label: "Triage",       count: stageCounts.triage,       dot: "bg-amber-500"   },
    { label: "Lab",          count: stageCounts.lab,          dot: "bg-purple-500"  },
    { label: "Consultation", count: stageCounts.consultation, dot: "bg-emerald-500" },
    { label: "Pharmacy",     count: stageCounts.pharmacy,     dot: "bg-teal-500"    },
    { label: "Done Today",   count: completedToday,           dot: "bg-slate-400"   },
  ];

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <main className="flex-1 p-5 md:p-7 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
            {roleHeading[role] ?? "Dashboard"}
          </p>
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {profile?.full_name?.split(" ")[0] ?? "Staff"}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            System Live
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map(kpi => {
          const t = trendConfig[kpi.trend];
          return (
            <div key={kpi.label} className="bg-white rounded-lg border border-slate-200/80 shadow-sm overflow-hidden">
              <div className={`h-[3px] ${t.bar}`} />
              <div className="px-5 pt-4 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 leading-none">
                  {kpi.label}
                </p>
                <p className={`mt-3 text-[32px] font-bold tabular-nums leading-none font-mono ${t.num}`}>
                  {kpi.value}
                </p>
                <p className={`mt-2 text-xs ${t.sub}`}>{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Patient flow pipeline — visible to manager/admin/receptionist/nurse */}
      {["receptionist","nurse","manager","admin"].includes(role) && (
        <div className="bg-white rounded-lg border border-slate-200/80 shadow-sm px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
            Patient Pipeline — Live
          </p>
          <div className="flex items-center">
            {pipeline.map((stage, i) => (
              <div key={stage.label} className="flex items-center flex-1 min-w-0">
                <div className="flex-1 min-w-0 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stage.count > 0 ? stage.dot : "bg-slate-200"}`} />
                    <span className={`text-xl font-bold font-mono tabular-nums leading-none ${stage.count > 0 ? "text-slate-800" : "text-slate-300"}`}>
                      {stage.count}
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 truncate px-1">
                    {stage.label}
                  </p>
                </div>
                {i < pipeline.length - 1 && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3 text-slate-200 shrink-0 mx-1">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Main panel: role-specific queue */}
        <div className="xl:col-span-2 bg-white rounded-lg border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-[13px] font-semibold text-slate-800">
                {mainPanelTitle[role] ?? "Active Visits"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {mainVisits.length} patient{mainVisits.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/queue"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Open Queue
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>

          {mainVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} className="w-9 h-9 mb-3 opacity-30">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <p className="text-sm font-medium text-slate-500">No patients in queue</p>
              <p className="text-xs mt-1 text-slate-400">
                {role === "receptionist" ? "Check in a patient to get started." : "Patients will appear as they move through the system."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    {["Visit #", "Patient", "Stage", "Wait", "Priority", ""].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mainVisits.map((v, i) => {
                    const isEmerg = v.priority === "emergency";
                    const waitMin = Math.floor((now - new Date(v.registered_at).getTime()) / 60000);
                    return (
                      <tr
                        key={v.id}
                        className="transition-colors"
                        style={{
                          borderBottom: i < mainVisits.length - 1 ? "1px solid #f8fafc" : "none",
                          background: isEmerg ? "rgba(254,242,242,0.4)" : "white",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isEmerg ? "rgba(254,242,242,0.7)" : "#f8fafc"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isEmerg ? "rgba(254,242,242,0.4)" : "white"; }}
                      >
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] font-mono text-slate-400">{v.visit_number}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-semibold text-slate-800 whitespace-nowrap">{v.patients?.full_name ?? "—"}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{v.patients?.patient_number}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ring-1 ${stageBadge[v.status] ?? "bg-slate-50 text-slate-500 ring-slate-200"}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[12px] font-mono font-semibold tabular-nums ${waitMin > 60 ? "text-red-600" : waitMin > 30 ? "text-amber-600" : "text-slate-500"}`}>
                            {waitMin}m
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ring-1 ${priorityBadge[v.priority] ?? ""}`}>
                            {v.priority}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/visits/${v.id}`}
                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                          >
                            Open
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Appointments strip — receptionist / manager / admin */}
          {["receptionist","manager","admin"].includes(role) && todayAppts.length > 0 && (
            <>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Today&apos;s Appointments
                </p>
                <Link href="/appointments" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {todayAppts.slice(0, 5).map((a:any, i:number) => (
                      <tr
                        key={a.id}
                        className="transition-colors"
                        style={{ borderBottom: i < Math.min(todayAppts.length, 5) - 1 ? "1px solid #f8fafc" : "none" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "white"; }}
                      >
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-medium text-slate-800">{a.patients?.full_name ?? "—"}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{a.appointment_number}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[12px] font-mono font-semibold text-slate-600">{a.scheduled_time?.slice(0,5)}</span>
                        </td>
                        <td className="px-5 py-3 text-[12px] text-slate-500 capitalize whitespace-nowrap">
                          {a.appointment_type?.replace(/_/g," ")}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ring-1 ${stageBadge[a.status] ?? ""}`}>
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

        {/* Right panel: alerts + quick stats */}
        <div className="space-y-4">
          {/* Live alerts */}
          <div className="bg-white rounded-lg border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-[13px] font-semibold text-slate-800">Live Alerts</h2>
              {alerts.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} className="w-7 h-7 mb-2 opacity-30">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-[13px] font-medium text-slate-500">No active alerts</p>
                <p className="text-[11px] mt-0.5 text-slate-400">System running normally</p>
              </div>
            ) : (
              <div>
                {alerts.map((alert, i) => {
                  const isCrit = alert.severity === "critical";
                  return (
                    <div
                      key={alert.id}
                      className="flex items-stretch transition-colors"
                      style={{ borderBottom: i < alerts.length - 1 ? "1px solid #f8fafc" : "none" }}
                    >
                      <div className={`w-[3px] shrink-0 ${isCrit ? "bg-red-500" : "bg-amber-400"}`} />
                      <div className="flex-1 px-4 py-3.5">
                        <div className="flex items-start gap-2">
                          <span className={`shrink-0 mt-px text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isCrit ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"}`}>
                            {isCrit ? "Critical" : "Warning"}
                          </span>
                          {alert.time && (
                            <span className="ml-auto text-[10px] font-mono text-slate-400 whitespace-nowrap">{alert.time}</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[12px] text-slate-700 leading-snug">{alert.message}</p>
                        <Link href={alert.link} className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                          View details
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-lg border border-slate-200/80 shadow-sm p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Quick Actions</p>
            <div className="space-y-1.5">
              {[
                { label: "Register patient",  href: "/queue",        icon: "M12 5v14M5 12h14" },
                { label: "New appointment",   href: "/appointments", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
                { label: "Patient search",    href: "/patients",     icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0" },
                { label: "Live queue",        href: "/queue",        icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
              ].filter(Boolean).map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[12px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4 text-slate-400 shrink-0">
                    <path d={item.icon} />
                  </svg>
                  {item.label}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-slate-300 ml-auto">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
