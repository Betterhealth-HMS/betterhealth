"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { VisitType, Priority } from "@/lib/supabase/types";

export async function checkInVisit(data: {
  existingPatientId?: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  idNumber?: string;
  employer?: string;
  contactPhone?: string;
  visitType: VisitType;
  chiefComplaint: string;
  priority: Priority;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let patientId = data.existingPatientId;

  if (!patientId) {
    if (!data.fullName || !data.dateOfBirth) throw new Error("Full name and date of birth are required");

    const { count } = await supabase.from("patients").select("*", { count: "exact", head: true });
    const patientNumber = `P-${String((count ?? 0) + 10001)}`;

    const { data: p, error: pErr } = await supabase
      .from("patients")
      .insert({
        patient_number: patientNumber,
        full_name: data.fullName,
        date_of_birth: data.dateOfBirth,
        gender: (data.gender as "male" | "female" | "other") ?? null,
        id_number: data.idNumber ?? null,
        employer: data.employer ?? null,
        contact_phone: data.contactPhone ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (pErr) throw new Error(pErr.message);
    patientId = p.id;
  }

  const ds = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const visitNumber = `V-${ds}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      visit_number: visitNumber,
      patient_id: patientId,
      visit_type: data.visitType,
      chief_complaint: data.chiefComplaint,
      priority: data.priority,
      status: "registered",
      registered_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/queue");
  revalidatePath("/dashboard");
  return visit.id;
}

export async function advanceVisit(visitId: string, newStatus: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();
  const u: Record<string, string | null> = { status: newStatus };

  if (newStatus === "triage")       { u.triage_started_at = now; }
  if (newStatus === "lab")          { u.triage_completed_at = now; u.lab_ordered_at = now; }
  if (newStatus === "consultation") { u.triage_completed_at = now; u.consultation_started_at = now; }
  if (newStatus === "pharmacy")     { u.consultation_completed_at = now; u.pharmacy_sent_at = now; }
  if (newStatus === "completed")    { u.pharmacy_completed_at = now; u.completed_at = now; }

  const { error } = await supabase.from("visits").update(u).eq("id", visitId);
  if (error) throw new Error(error.message);

  revalidatePath("/queue");
  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/dashboard");
}

export async function recordVitals(visitId: string, v: {
  bpSystolic?: number | null; bpDiastolic?: number | null;
  pulseRate?: number | null; temperature?: number | null;
  weightKg?: number | null; heightCm?: number | null;
  oxygenSaturation?: number | null; respiratoryRate?: number | null;
  bloodGlucose?: number | null; painScale?: number | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const bmi = v.weightKg && v.heightCm
    ? Math.round(v.weightKg / Math.pow(v.heightCm / 100, 2) * 10) / 10
    : null;

  const { error } = await supabase.from("vitals").insert({
    visit_id: visitId,
    blood_pressure_systolic: v.bpSystolic ?? null,
    blood_pressure_diastolic: v.bpDiastolic ?? null,
    pulse_rate: v.pulseRate ?? null,
    temperature: v.temperature ?? null,
    weight_kg: v.weightKg ?? null,
    height_cm: v.heightCm ?? null,
    bmi,
    oxygen_saturation: v.oxygenSaturation ?? null,
    respiratory_rate: v.respiratoryRate ?? null,
    blood_glucose: v.bloodGlucose ?? null,
    pain_scale: v.painScale ?? null,
    notes: v.notes ?? null,
    recorded_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/visits/${visitId}`);
}

export async function saveConsultation(visitId: string, notes: {
  subjective?: string; objective?: string; assessment?: string; plan?: string;
  diagnosisCode?: string; diagnosisDescription?: string;
  followUpRequired?: boolean; followUpDate?: string; followUpInstructions?: string;
  workStatus?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("consultation_notes").upsert({
    visit_id: visitId,
    subjective: notes.subjective ?? null,
    objective: notes.objective ?? null,
    assessment: notes.assessment ?? null,
    plan: notes.plan ?? null,
    diagnosis_code: notes.diagnosisCode ?? null,
    diagnosis_description: notes.diagnosisDescription ?? null,
    follow_up_required: notes.followUpRequired ?? false,
    follow_up_date: notes.followUpDate ?? null,
    follow_up_instructions: notes.followUpInstructions ?? null,
    work_status: (notes.workStatus as "fit" | "fit_with_restrictions" | "temporarily_unfit" | "unfit") ?? null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/visits/${visitId}`);
}

export async function createPrescription(
  visitId: string,
  items: { medicationName: string; dosage: string; frequency: string; duration?: string; quantity?: number; instructions?: string }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: rx, error: rxErr } = await supabase
    .from("prescriptions")
    .insert({ visit_id: visitId, prescribed_by: user.id, status: "pending" })
    .select("id")
    .single();

  if (rxErr) throw new Error(rxErr.message);

  const { error: iErr } = await supabase.from("prescription_items").insert(
    items.map(it => ({
      prescription_id: rx.id,
      medication_name: it.medicationName,
      dosage: it.dosage,
      frequency: it.frequency,
      duration: it.duration ?? null,
      quantity: it.quantity ?? null,
      instructions: it.instructions ?? null,
    }))
  );

  if (iErr) throw new Error(iErr.message);
  revalidatePath(`/visits/${visitId}`);
  return rx.id;
}

export async function dispensePrescription(prescriptionId: string, visitId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("prescriptions").update({
    status: "dispensed",
    dispensed_at: new Date().toISOString(),
    dispensed_by: user.id,
  }).eq("id", prescriptionId);

  await supabase.from("prescription_items").update({ is_dispensed: true }).eq("prescription_id", prescriptionId);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/queue");
}
