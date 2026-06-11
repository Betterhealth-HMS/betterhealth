import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import RoomStatusButton from "./RoomStatusButton";

type Room       = Database["public"]["Tables"]["rooms"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = { title: "Facility — BetterHealth" };

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  ready:       { label: "Ready",       cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  occupied:    { label: "Occupied",    cls: "bg-blue-50 text-blue-800 ring-blue-200",          dot: "bg-blue-500 animate-pulse" },
  cleaning:    { label: "Cleaning",    cls: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-500" },
  maintenance: { label: "Maintenance", cls: "bg-red-50 text-red-800 ring-red-200",             dot: "bg-red-500" },
  reserved:    { label: "Reserved",    cls: "bg-purple-50 text-purple-800 ring-purple-200",    dot: "bg-purple-500" },
};

const ALLOWED_ROLES = ["nurse", "manager", "admin"];

export default async function FacilityPage() {
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

  const { data: roomsData } = await supabase.from("rooms").select("*").order("room_number");
  const rooms = roomsData as Room[] | null;

  const counts = {
    ready:       rooms?.filter(r => r.status === "ready").length ?? 0,
    occupied:    rooms?.filter(r => r.status === "occupied").length ?? 0,
    cleaning:    rooms?.filter(r => r.status === "cleaning").length ?? 0,
    maintenance: rooms?.filter(r => r.status === "maintenance").length ?? 0,
  };

  const departments = [...new Set(rooms?.map(r => r.department) ?? [])];

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Facility</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Room readiness &amp; status board</p>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full ring-1 ring-outline-variant">
          {rooms?.length ?? 0} rooms total
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Ready",       value: counts.ready,       cls: "text-emerald-700" },
          { label: "Occupied",    value: counts.occupied,    cls: "text-blue-700" },
          { label: "Cleaning",    value: counts.cleaning,    cls: "text-amber-700" },
          { label: "Maintenance", value: counts.maintenance, cls: "text-red-700" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-outline-variant bg-white px-5 py-4 shadow-sm">
            <p className={`text-2xl font-bold font-mono tabular-nums ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rooms by department */}
      {departments.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-white p-12 flex flex-col items-center justify-center text-on-surface-variant shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4 opacity-25">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <p className="text-sm font-medium">No rooms configured</p>
          <p className="text-xs mt-1 opacity-70">Add rooms in the Supabase database to see them here.</p>
        </div>
      ) : (
        departments.map(dept => (
          <div key={dept} className="rounded-lg border border-outline-variant bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-outline-variant bg-surface-container-low">
              <h2 className="text-sm font-semibold text-on-surface">{dept}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {rooms?.filter(r => r.department === dept).map(room => {
                const sc = statusConfig[room.status] ?? statusConfig.ready;
                return (
                  <div key={room.id} className="rounded-lg border border-outline-variant p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-on-surface text-sm">{room.room_name}</p>
                        <p className="text-xs text-on-surface-variant font-mono mt-0.5">{room.room_number}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 shrink-0 ${sc.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                    {room.last_cleaned_at && (
                      <p className="text-xs text-on-surface-variant mb-3">
                        Last cleaned: {new Date(room.last_cleaned_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    )}
                    <RoomStatusButton id={room.id} status={room.status} />
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
