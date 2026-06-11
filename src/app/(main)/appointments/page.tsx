import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import NewAppointmentModal from "./NewAppointmentModal";
import AppointmentActions from "./AppointmentActions";

export const metadata: Metadata = { title: "Appointments — BetterHealth" };

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type ProfileRow     = Database["public"]["Tables"]["profiles"]["Row"];

const statusStyles: Record<string, string> = {
  scheduled: "bg-surface-container text-primary ring-outline-variant",
  confirmed: "bg-blue-50 text-blue-800 ring-blue-200",
  arrived:   "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-red-50 text-red-800 ring-red-200",
  no_show:   "bg-red-50 text-red-800 ring-red-200",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled", confirmed: "Confirmed", arrived: "Arrived",
  completed: "Completed", cancelled: "Cancelled", no_show: "No Show",
};

const ALLOWED_ROLES = ["receptionist", "doctor", "manager", "admin"];

export default async function AppointmentsPage() {
  const supabase = await createClient();

  // Role guard
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<ProfileRow, "role"> | null;
  const role    = profile?.role ?? "receptionist";
  if (!ALLOWED_ROLES.includes(role)) redirect("/dashboard");

  const todayStr = new Date().toISOString().split("T")[0];

  const [{ data: appointmentsRaw }, { data: doctorsRaw }, { data: patientsRaw }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, appointment_number, appointment_type, scheduled_date, scheduled_time, " +
        "assigned_doctor, status, notes, patients(full_name, patient_number, date_of_birth)"
      )
      .gte("scheduled_date", todayStr)
      .order("scheduled_date")
      .order("scheduled_time")
      .limit(100),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["doctor", "manager", "admin"]),
    supabase
      .from("patients")
      .select("id, full_name, patient_number")
      .order("full_name")
      .limit(500),
  ]);

  const appointments = (appointmentsRaw as unknown as (AppointmentRow & { patients: any })[]) ?? [];
  const doctors      = (doctorsRaw ?? []) as { id: string; full_name: string | null }[];
  const patients     = (patientsRaw ?? []) as { id: string; full_name: string; patient_number: string }[];
  const doctorMap    = Object.fromEntries(doctors.map(d => [d.id, d.full_name ?? "Doctor"]));

  const todayAppts  = appointments.filter(a => a.scheduled_date === todayStr);
  const scheduled   = todayAppts.filter(a => a.status === "scheduled").length;
  const completedCt = appointments.filter(a => a.status === "completed").length;
  const cancelled   = appointments.filter(a => a.status === "cancelled").length;

  const summaryStats = [
    { label: "Total Upcoming",  value: appointments.length, color: "text-on-surface" },
    { label: "Today",           value: todayAppts.length,   color: "text-primary" },
    { label: "Scheduled Today", value: scheduled,           color: "text-amber-700" },
    { label: "Completed Today", value: completedCt,         color: "text-emerald-700" },
  ];

  const canBook = ["receptionist", "manager", "admin"].includes(role);

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Appointments</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {canBook && <NewAppointmentModal doctors={doctors} patients={patients} />}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {summaryStats.map((s) => (
          <div key={s.label} className="rounded-lg border border-outline-variant bg-white px-5 py-4 shadow-sm">
            <p className={`text-2xl font-bold font-mono tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Appointments table */}
      {appointments.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-white p-12 flex flex-col items-center justify-center text-on-surface-variant shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4 opacity-25">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-sm font-medium">No appointments scheduled</p>
          <p className="text-xs mt-1 opacity-70">Upcoming appointments will appear here once created.</p>
          {canBook && (
            <div className="mt-4">
              <NewAppointmentModal doctors={doctors} patients={patients} />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-outline-variant bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
            <h2 className="text-sm font-semibold text-on-surface">Upcoming Appointments</h2>
            {cancelled > 0 && (
              <span className="text-xs text-on-surface-variant">{cancelled} cancelled today</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Ref", "Patient", "Date", "Time", "Type", "Doctor", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {appointments.map((apt) => {
                  const isToday = apt.scheduled_date === todayStr;
                  const docName = apt.assigned_doctor ? (doctorMap[apt.assigned_doctor] ?? "—") : "—";
                  return (
                    <tr key={apt.id} className={`transition-colors ${isToday ? "hover:bg-primary-100/40" : "hover:bg-surface-container-low"}`}>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                        {apt.appointment_number}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-on-surface">{apt.patients?.full_name ?? "—"}</p>
                        <p className="text-xs text-on-surface-variant font-mono">{apt.patients?.patient_number}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className={`font-mono text-xs ${isToday ? "text-primary font-semibold" : "text-on-surface-variant"}`}>
                          {apt.scheduled_date}
                        </p>
                        {isToday && <p className="text-xs text-primary">Today</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-on-surface-variant whitespace-nowrap">
                        {apt.scheduled_time?.slice(0, 5) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap capitalize">
                        {apt.appointment_type?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap text-xs">
                        {docName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${statusStyles[apt.status] ?? ""}`}>
                          {statusLabels[apt.status] ?? apt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <AppointmentActions id={apt.id} status={apt.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-low">
            <p className="text-xs text-on-surface-variant">
              Showing {appointments.length} upcoming appointment{appointments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
