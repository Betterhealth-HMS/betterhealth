"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateRoomStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const updates: Record<string, unknown> = { status, updated_by: user.id };
  if (status === "ready") updates.last_cleaned_at = new Date().toISOString();

  const { error } = await supabase
    .from("rooms")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/facility");
}
