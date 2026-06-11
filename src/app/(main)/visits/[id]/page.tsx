import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { advanceVisit } from "@/app/actions/visits";
import VitalsForm from "./VitalsForm";
import ConsultationForm from "./ConsultationForm";
import PrescriptionSection from "./PrescriptionSection";
import type { Role } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Visit — BetterHealth" };

const statusStages = ["registered", "triage", "lab", "consultation", "pharmacy", "completed"];
const statusLabel: Record<string, string> = {
  registered: "Registered", triage: "Triage", lab: "Lab",
  consultation: "Consultation", pharmacy: "Pharmacy", completed: "Completed", cancelled: "Cancelled",
};
const nextStatus: Record<string, { status: string; label: string }> = {
  registered:   { status: "triage",       label: "Send to Triage" },
  triage:       { status: "consultation", label: "Send to Consultation" },
  lab:          { status: "consultation", label: "Send to Consultation" },
  consultation: { status: "pharmacy",     label: "Send to Pharmacy" },
  pharmacy:     { status: "completed",    label: "Mark Complete" },
};

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: visitRaw }, { data: { user } }, { data: profiles }] = await Promise.all([
    supabase
      .from("visits")
      .select(`*, patients(*), vitals(*), consultation_notes(*), prescriptions(*, prescription_items(*))`)
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
    supabase.from("profiles").select("id, full_name, role"),
  ]);

  if (!visitRaw) notFound();

  const visit = visitRaw as any;
  const patient = visit.patients;
  const vitals: any[] = visit.vitals ?? [];
  const notes = Array.isArray(visit.consultation_notes) ? visit.consultation_notes[0] : visit.consultation_notes;
  const prescriptions: any[] = visit.prescriptions ?? [];

  const safeProfiles = (profiles ?? []) as { id: string; full_name: string; role: string }[];
  const currentProfile = safeProfiles.find(p => p.id === user?.id);
  const role = (currentProfile?.role ?? "receptionist") as Role;
  const doctorName = safeProfiles.find(p => p.id === visit.assigned_doctor)?.full_name;

  const canNurse = ["nurse", "manager", "admin"].includes(role);
  const canDoctor = ["doctor", "manager", "admin"].includes(role);
  const canPharmacist = ["pharmacist", "manager", "admin"].includes(role);

  const currentStageIdx = statusStages.indexOf(visit.status);
  const next = nextStatus[visit.status];

  const dob = patient?.date_of_birth ? new Date(patient.date_of_birth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  const latestVitals = vitals[vitals.length - 1];

  return (
    <main className="flex-1 p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Link href="/queue" className="hover:text-primary transition-colors">Live Queue</Link>
        <span>›</span>
        <span className="text-on-surface font-medium">{visit.visit_number}</span>
      </div>

      {/* Header card */}
      <div className="rounded-lg border border-outline-variant bg-white px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {patient?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-on-surface">{patient?.full_name ?? "Unknown Patient"}</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                {patient?.patient_number} &middot; {age ? `${age}y` : "—"} &middot; {patient?.gender ?? "—"} &middot; Blood: {patient?.blood_type ?? "Unknown"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 font-mono">{visit.visit_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Priority */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 capitalize ${
              visit.priority === "emergency" ? "bg-red-50 text-red-800 ring-red-200" :
              visit.priority === "urgent" ? "bg-amber-50 text-amber-800 ring-amber-200" :
              "bg-surface-container text-on-surface-variant ring-outline-variant"
            }`}>{visit.priority}</span>

            {/* Advance button */}
            {next && visit.status !== "completed" && (
              <form action={async () => { "use server"; await advanceVisit(id, next.status); }}>
                <button type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors">
                  {next.label} →
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div className="mt-5 flex items-center gap-1 overflow-x-auto">
          {statusStages.map((s, i) => {
            const past = i < currentStageIdx;
            const current = i === currentStageIdx;
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                {i > 0 && <div className={`w-6 h-px ${past || current ? "bg-primary" : "bg-outline-variant"}`} />}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  current ? "bg-primary text-on-primary" :
                  past ? "bg-primary/15 text-primary" :
                  "bg-surface-container text-on-surface-variant"
                }`}>
                  {past && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>}
                  {statusLabel[s]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: patient info + visit info */}
        <div className="space-y-4">
          {/* Patient demographics */}
          <div className="rounded-lg border border-outline-variant bg-white">
            <div className="px-5 py-3.5 border-b border-outline-variant">
              <h2 className="text-sm font-semibold text-on-surface">Patient Demographics</h2>
            </div>
            <div className="px-5 py-4 space-y-2.5 text-xs">
              {[
                ["DOB", patient?.date_of_birth ?? "—"],
                ["ID Number", patient?.id_number ?? "—"],
                ["Employer", patient?.employer ?? "—"],
                ["Phone", patient?.contact_phone ?? "—"],
                ["Medical Aid", patient?.medical_aid_provider ?? "—"],
                ["MA Number", patient?.medical_aid_number ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-on-surface-variant shrink-0">{label}</span>
                  <span className="text-on-surface font-medium text-right">{value}</span>
                </div>
              ))}
              {patient?.allergies?.length > 0 && (
                <div>
                  <span className="text-on-surface-variant">Allergies</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.allergies.map((a: string) => (
                      <span key={a} className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-xs font-medium ring-1 ring-error/20">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visit info */}
          <div className="rounded-lg border border-outline-variant bg-white">
            <div className="px-5 py-3.5 border-b border-outline-variant">
              <h2 className="text-sm font-semibold text-on-surface">Visit Info</h2>
            </div>
            <div className="px-5 py-4 space-y-2.5 text-xs">
              {[
                ["Type", visit.visit_type?.replace(/_/g, " ")],
                ["Complaint", visit.chief_complaint ?? "—"],
                ["Registered", new Date(visit.registered_at).toLocaleString()],
                ["Doctor", doctorName ?? "Unassigned"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-on-surface-variant shrink-0">{label}</span>
                  <span className="text-on-surface font-medium text-right capitalize">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Latest vitals summary */}
          {latestVitals && (
            <div className="rounded-lg border border-outline-variant bg-white">
              <div className="px-5 py-3.5 border-b border-outline-variant">
                <h2 className="text-sm font-semibold text-on-surface">Latest Vitals</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-2 text-xs">
                {[
                  ["BP", latestVitals.blood_pressure_systolic ? `${latestVitals.blood_pressure_systolic}/${latestVitals.blood_pressure_diastolic} mmHg` : "—"],
                  ["Pulse", latestVitals.pulse_rate ? `${latestVitals.pulse_rate} bpm` : "—"],
                  ["Temp", latestVitals.temperature ? `${latestVitals.temperature}°C` : "—"],
                  ["SpO₂", latestVitals.oxygen_saturation ? `${latestVitals.oxygen_saturation}%` : "—"],
                  ["Weight", latestVitals.weight_kg ? `${latestVitals.weight_kg} kg` : "—"],
                  ["BMI", latestVitals.bmi ?? "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-on-surface-variant">{label}</p>
                    <p className="font-semibold text-on-surface font-mono">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: clinical sections */}
        <div className="lg:col-span-2 space-y-5">
          {/* Vitals recording (nurse) */}
          <div className="rounded-lg border border-outline-variant bg-white">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-sm font-semibold text-on-surface">Vitals &amp; Triage</h2>
              {vitals.length > 0 && <p className="text-xs text-on-surface-variant mt-0.5">{vitals.length} recording{vitals.length > 1 ? "s" : ""} on file</p>}
            </div>
            <div className="px-6 py-5">
              {canNurse ? (
                <VitalsForm visitId={id} />
              ) : (
                <p className="text-sm text-on-surface-variant">{vitals.length === 0 ? "No vitals recorded yet." : "Vitals recorded."}</p>
              )}
            </div>
          </div>

          {/* Consultation notes (doctor) */}
          <div className="rounded-lg border border-outline-variant bg-white">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-sm font-semibold text-on-surface">Consultation Notes</h2>
            </div>
            <div className="px-6 py-5">
              {canDoctor ? (
                <ConsultationForm visitId={id} existing={notes} />
              ) : notes ? (
                <div className="space-y-3 text-sm text-on-surface">
                  {notes.assessment && <p><span className="font-semibold">Assessment: </span>{notes.assessment}</p>}
                  {notes.plan && <p><span className="font-semibold">Plan: </span>{notes.plan}</p>}
                  {notes.work_status && <p><span className="font-semibold">Work Status: </span><span className="capitalize">{notes.work_status.replace(/_/g, " ")}</span></p>}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">No consultation notes yet.</p>
              )}
            </div>
          </div>

          {/* Prescription (doctor prescribes, pharmacist dispenses) */}
          <div className="rounded-lg border border-outline-variant bg-white">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-sm font-semibold text-on-surface">Prescription</h2>
            </div>
            <div className="px-6 py-5">
              <PrescriptionSection
                visitId={id}
                prescriptions={prescriptions}
                canPrescribe={canDoctor}
                canDispense={canPharmacist}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
