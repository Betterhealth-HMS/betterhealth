import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import QueueBoard from "./QueueBoard";

export const metadata: Metadata = { title: "Live Queue — BetterHealth" };

export default async function QueuePage() {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ data: visits }, { data: { user } }, { data: profiles }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visit_number, visit_type, chief_complaint, status, priority, registered_at, patients(patient_number, full_name, date_of_birth)")
      .gte("registered_at", today.toISOString())
      .order("registered_at", { ascending: true }),
    supabase.auth.getUser(),
    supabase.from("profiles").select("id, role"),
  ]);

  const safeProfiles = (profiles ?? []) as { id: string; role: string }[];
  const currentRole = safeProfiles.find(p => p.id === user?.id)?.role ?? "receptionist";

  return (
    <QueueBoard
      initialVisits={(visits ?? []) as any}
      currentUserRole={currentRole}
    />
  );
}
