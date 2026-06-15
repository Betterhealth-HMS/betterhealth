import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import AnalyticsCharts from "./AnalyticsCharts";

export const metadata: Metadata = { title: "Analytics — BetterHealth" };

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function dayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function diffMin(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return diff < 0 ? null : Math.round(diff);
}

function fmtMin(n: number | null) {
  if (n === null) return "—";
  return `${n}m`;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<ProfileRow, "role"> | null;
  const role    = profile?.role ?? "receptionist";

  if (!["manager", "admin"].includes(role)) redirect("/dashboard");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const todayStart   = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: weekVisitsRaw },
    { data: todayVisitsRaw },
    { data: inventoryRaw },
    { data: breakdownRaw },
  ] = await Promise.all([
    supabase
      .from("visits")
      .select("registered_at, status, visit_type")
      .gte("registered_at", sevenDaysAgo.toISOString()),
    supabase
      .from("visits")
      .select("status, priority, registered_at, completed_at")
      .gte("registered_at", todayStart.toISOString())
      .not("status", "eq", "cancelled"),
    supabase
      .from("inventory")
      .select("current_stock, reorder_level"),
    supabase
      .from("visits")
      .select("visit_number, registered_at, triage_started_at, consultation_started_at, pharmacy_sent_at, completed_at, patients(full_name)")
      .gte("registered_at", todayStart.toISOString())
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
  ]);

  const weekVisits  = (weekVisitsRaw  ?? []) as any[];
  const todayVisits = (todayVisitsRaw ?? []) as any[];
  const inventory   = (inventoryRaw   ?? []) as any[];
  const breakdown   = (breakdownRaw   ?? []) as any[];

  // ── Summary metrics ──────────────────────────────────────────────────────
  const totalToday     = todayVisits.length;
  const completedToday = todayVisits.filter(v => v.status === "completed").length;
  const activeNow      = todayVisits.filter(v => !["completed", "cancelled"].includes(v.status)).length;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const emergencyToday = todayVisits.filter(v => v.priority === "emergency").length;
  const lowStockCount  = inventory.filter((i: any) => i.current_stock <= i.reorder_level).length;

  const weekTotal     = weekVisits.length;
  const weekCompleted = weekVisits.filter(v => v.status === "completed").length;

  const avgVisitMin = (() => {
    const valid = todayVisits
      .filter((v: any) => v.status === "completed" && v.completed_at)
      .map((v: any) => (new Date(v.completed_at).getTime() - new Date(v.registered_at).getTime()) / 60000);
    return valid.length ? Math.round(valid.reduce((s: number, v: number) => s + v, 0) / valid.length) : 0;
  })();

  // ── 7-day bar chart ────────────────────────────────────────────────────────
  const weeklyMap: Record<string, { total: number; completed: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    weeklyMap[d.toISOString().split("T")[0]] = { total: 0, completed: 0 };
  }
  for (const v of weekVisits) {
    const key = (v.registered_at as string).split("T")[0];
    if (weeklyMap[key]) {
      weeklyMap[key].total++;
      if (v.status === "completed") weeklyMap[key].completed++;
    }
  }
  const weeklyData = Object.entries(weeklyMap).map(([date, d]) => ({ date: dayLabel(date), ...d }));

  // ── Stage pipeline (today) ─────────────────────────────────────────────────
  const stageData = [
    { stage: "Registered",   count: todayVisits.filter(v => v.status === "registered").length   },
    { stage: "Triage",       count: todayVisits.filter(v => v.status === "triage").length       },
    { stage: "Lab",          count: todayVisits.filter(v => v.status === "lab").length          },
    { stage: "Consultation", count: todayVisits.filter(v => v.status === "consultation").length },
    { stage: "Pharmacy",     count: todayVisits.filter(v => v.status === "pharmacy").length     },
    { stage: "Completed",    count: completedToday                                               },
  ];

  // ── Visit type breakdown (7 days) ─────────────────────────────────────────
  const typeMap: Record<string, number> = {};
  for (const v of weekVisits) {
    const t = (v.visit_type as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    typeMap[t] = (typeMap[t] ?? 0) + 1;
  }
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  // ── Per-visit stage breakdown (today's completed) ──────────────────────────
  type BreakdownRow = {
    visit_number: string;
    patient_name: string;
    wait_triage:   number | null;
    wait_consult:  number | null;
    wait_pharmacy: number | null;
    wait_complete: number | null;
    total:         number | null;
  };
  const visitBreakdown: BreakdownRow[] = breakdown.map(v => ({
    visit_number:  v.visit_number,
    patient_name:  (v.patients as any)?.full_name ?? "—",
    wait_triage:   diffMin(v.registered_at,          v.triage_started_at),
    wait_consult:  diffMin(v.triage_started_at,      v.consultation_started_at),
    wait_pharmacy: diffMin(v.consultation_started_at, v.pharmacy_sent_at),
    wait_complete: diffMin(v.pharmacy_sent_at,        v.completed_at),
    total:         diffMin(v.registered_at,           v.completed_at),
  }));

  const summaryCards = [
    { label: "Patients Today",     value: totalToday,                                     sub: `${activeNow} still active`,        color: "text-on-surface",          bar: "bg-primary" },
    { label: "Completion Rate",    value: `${completionRate}%`,                           sub: `${completedToday} completed`,      color: completionRate >= 80 ? "text-emerald-700" : "text-amber-700", bar: completionRate >= 80 ? "bg-emerald-500" : "bg-amber-500" },
    { label: "Avg Visit Duration", value: avgVisitMin > 0 ? `${avgVisitMin}m` : "—",     sub: "per completed visit",              color: "text-on-surface",          bar: "bg-secondary" },
    { label: "Week Total",         value: weekTotal,                                      sub: `${weekCompleted} completed`,       color: "text-on-surface",          bar: "bg-teal" },
    { label: "Emergency Today",    value: emergencyToday,                                 sub: "high-priority visits",             color: emergencyToday > 0 ? "text-red-700" : "text-emerald-700", bar: emergencyToday > 0 ? "bg-red-500" : "bg-emerald-500" },
    { label: "Low Stock Items",    value: lowStockCount,                                  sub: "below reorder level",              color: lowStockCount > 0 ? "text-amber-700" : "text-emerald-700", bar: lowStockCount > 0 ? "bg-amber-500" : "bg-emerald-500" },
  ];

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Analytics &amp; Reports</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full ring-1 ring-outline-variant">
          Data: today + last 7 days
        </span>
      </div>

      {/* Summary KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
            <div className={`text-2xl font-bold font-mono tabular-nums ${c.color}`}>{c.value}</div>
            <p className="text-xs font-semibold text-on-surface mt-2">{c.label}</p>
            <p className="text-xs text-on-surface-variant mt-0.5">{c.sub}</p>
            <div className="mt-2 h-0.5 rounded-full bg-outline-variant/50">
              <div className={`h-0.5 rounded-full ${c.bar}`} style={{ width: "60%" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <AnalyticsCharts weeklyData={weeklyData} stageData={stageData} typeData={typeData} />

      {/* Per-visit exact time breakdown */}
      <div className="rounded-lg border border-outline-variant bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Today's Visit Time Breakdown</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Exact minutes spent at each stage (today's completed visits)</p>
          </div>
          <span className="text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full ring-1 ring-outline-variant">
            {visitBreakdown.length} completed
          </span>
        </div>

        {visitBreakdown.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            No completed visits yet today. Data will appear as patients complete their journey.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Visit #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Patient</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Wait→Triage</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Triage→Consult</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Consult→Pharmacy</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Pharmacy→Done</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {visitBreakdown.map(v => (
                  <tr key={v.visit_number} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{v.visit_number}</td>
                    <td className="px-4 py-3 text-on-surface font-medium">{v.patient_name}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-on-surface">{fmtMin(v.wait_triage)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-on-surface">{fmtMin(v.wait_consult)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-on-surface">{fmtMin(v.wait_pharmacy)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-on-surface">{fmtMin(v.wait_complete)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums ${
                      v.total !== null && v.total > 120 ? "text-red-700" : v.total !== null && v.total > 60 ? "text-amber-700" : "text-emerald-700"
                    }`}>
                      {fmtMin(v.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {visitBreakdown.length > 1 && (() => {
                const avg = (vals: (number | null)[]) => {
                  const v = vals.filter(x => x !== null) as number[];
                  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
                };
                return (
                  <tfoot>
                    <tr className="border-t-2 border-outline-variant bg-surface-container-low">
                      <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-on-surface-variant">Average</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-on-surface">{fmtMin(avg(visitBreakdown.map(v => v.wait_triage)))}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-on-surface">{fmtMin(avg(visitBreakdown.map(v => v.wait_consult)))}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-on-surface">{fmtMin(avg(visitBreakdown.map(v => v.wait_pharmacy)))}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-on-surface">{fmtMin(avg(visitBreakdown.map(v => v.wait_complete)))}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-on-surface">{fmtMin(avg(visitBreakdown.map(v => v.total)))}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
