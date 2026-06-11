"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ChecklistItem } from "@/lib/supabase/types";

export async function startChecklist(data: {
  checklistType: string;
  shiftType: string;
  items: ChecklistItem[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const today = new Date().toISOString().split("T")[0];

  // Prevent duplicate active checklist for same type+date+shift
  const { data: existing } = await supabase
    .from("audit_checklists")
    .select("id")
    .eq("checklist_date", today)
    .eq("checklist_type", data.checklistType)
    .eq("shift_type", data.shiftType)
    .in("status", ["pending", "in_progress"])
    .maybeSingle();

  if (existing) return { id: existing.id };

  const { data: created, error } = await supabase
    .from("audit_checklists")
    .insert({
      checklist_date: today,
      checklist_type: data.checklistType,
      shift_type: data.shiftType,
      status: "in_progress",
      items: data.items,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/checklists");
  return { id: created.id };
}

export async function saveChecklistProgress(id: string, items: ChecklistItem[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("audit_checklists")
    .update({ items, status: "in_progress" })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}

export async function submitChecklist(id: string, items: ChecklistItem[], notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const requiredAll = items.filter(i => i.required).every(i => i.checked);
  const status = requiredAll ? "completed" : "completed_with_issues";

  const { error } = await supabase
    .from("audit_checklists")
    .update({
      items,
      notes: notes || null,
      status,
      completed_by: user.id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}
