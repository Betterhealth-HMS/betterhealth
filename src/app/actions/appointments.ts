"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createAppointment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const patientId       = formData.get("patient_id") as string;
  const assignedDoctor  = (formData.get("assigned_doctor") as string) || null;
  const scheduledDate   = formData.get("scheduled_date") as string;
  const scheduledTime   = formData.get("scheduled_time") as string;
  const appointmentType = formData.get("appointment_type") as string;
  const notes           = (formData.get("notes") as string) || null;

  if (!patientId || !scheduledDate || !scheduledTime || !appointmentType) {
    throw new Error("Missing required fields");
  }

  // Generate appointment number
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true });
  const apptNum = `APT-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { error } = await supabase.from("appointments").insert({
    appointment_number: apptNum,
    patient_id: patientId,
    assigned_doctor: assignedDoctor,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    appointment_type: appointmentType,
    notes,
    status: "scheduled",
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function updateAppointmentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
