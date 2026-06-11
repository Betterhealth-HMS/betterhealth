import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import PatientsSearch from "./PatientsSearch";

export const metadata: Metadata = { title: "Patients — BetterHealth" };

type PatientRow  = Database["public"]["Tables"]["patients"]["Row"];
type ProfileRow  = Database["public"]["Tables"]["profiles"]["Row"];

function getAge(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

const ALLOWED_ROLES = ["receptionist", "nurse", "doctor", "manager", "admin"];

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
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

  const params = await searchParams;
  const q      = (params.q ?? "").trim();
  const gender = params.gender ?? "";

  const { data: patientsRaw } = await supabase
    .from("patients")
    .select(
      "id, patient_number, full_name, date_of_birth, gender, blood_type, id_number, " +
      "employer, contact_phone, medical_aid_provider, chronic_conditions, allergies, created_at"
    )
    .order("full_name");

  let patients = (patientsRaw as unknown as PatientRow[]) ?? [];

  if (q) {
    const lower = q.toLowerCase();
    patients = patients.filter(p =>
      p.full_name.toLowerCase().includes(lower) ||
      p.patient_number.toLowerCase().includes(lower) ||
      (p.id_number ?? "").toLowerCase().includes(lower)
    );
  }
  if (gender) {
    patients = patients.filter(p => p.gender === gender);
  }

  const allPatients = (patientsRaw as unknown as PatientRow[]) ?? [];
  const summaryStats = [
    { label: "Total Patients",    value: allPatients.length,                                        color: "text-on-surface" },
    { label: "Male",              value: allPatients.filter(p => p.gender === "male").length,       color: "text-primary" },
    { label: "Female",            value: allPatients.filter(p => p.gender === "female").length,     color: "text-secondary" },
    { label: "With Medical Aid",  value: allPatients.filter(p => p.medical_aid_provider).length,    color: "text-teal" },
  ];

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Patients</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {allPatients.length} record{allPatients.length !== 1 ? "s" : ""} on file
            {(q || gender) && ` · ${patients.length} matching filter`}
          </p>
        </div>
        <Link
          href="/queue"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Register Patient
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {summaryStats.map((s) => (
          <div key={s.label} className="rounded-lg border border-outline-variant bg-white px-5 py-4 shadow-sm">
            <p className={`text-2xl font-bold font-mono tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <PatientsSearch initialQ={q} initialGender={gender} />

      {/* Patients table */}
      {patients.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-white p-12 flex flex-col items-center justify-center text-on-surface-variant shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4 opacity-25">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {q || gender ? (
            <>
              <p className="text-sm font-medium">No patients match your search</p>
              <p className="text-xs mt-1 opacity-70">Try a different name or clear the filter.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">No patients on file</p>
              <p className="text-xs mt-1 opacity-70">Patients are registered through the Live Queue check-in.</p>
              <Link href="/queue" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors">
                Go to Queue
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-outline-variant bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Patient ID", "Name", "Age / DOB", "Gender", "Blood Type", "Employer", "Medical Aid", "Phone", "Registered"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {patients.map((p) => {
                  const age      = getAge(p.date_of_birth);
                  const initials = p.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-on-surface-variant whitespace-nowrap">{p.patient_number}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium text-on-surface">{p.full_name}</p>
                            {p.allergies && p.allergies.length > 0 && (
                              <p className="text-xs text-red-700 font-medium">⚠ Allergies on file</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-on-surface font-medium">{age != null ? `${age}y` : "—"}</p>
                        <p className="text-xs text-on-surface-variant font-mono">{p.date_of_birth ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3.5 text-on-surface-variant capitalize whitespace-nowrap">{p.gender ?? "—"}</td>
                      <td className="px-5 py-3.5 font-mono text-sm font-semibold text-on-surface whitespace-nowrap">{p.blood_type ?? "—"}</td>
                      <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{p.employer ?? <span className="text-outline">—</span>}</td>
                      <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">{p.medical_aid_provider ?? <span className="text-outline">—</span>}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-on-surface-variant whitespace-nowrap">{p.contact_phone ?? "—"}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-low">
            <p className="text-xs text-on-surface-variant">
              Showing {patients.length} patient{patients.length !== 1 ? "s" : ""}
              {(q || gender) && ` (filtered from ${allPatients.length})`}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
