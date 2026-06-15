"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ChecklistItem } from "@/lib/supabase/types";
import { randomUUID } from "crypto";

function detectShift(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "night";
}

export async function startChecklist(data: { templateId: string; shiftType?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const today     = new Date().toISOString().split("T")[0];
  const shiftType = data.shiftType ?? detectShift();

  // Fetch template from DB — never trust client-supplied items
  const { data: template, error: tErr } = await supabase
    .from("checklist_templates")
    .select("id, name, items")
    .eq("id", data.templateId)
    .eq("is_active", true)
    .single();

  if (tErr || !template) throw new Error("Template not found or inactive");

  // Prevent duplicate active checklist for same template + date + shift
  const { data: existing } = await supabase
    .from("audit_checklists")
    .select("id")
    .eq("checklist_date", today)
    .eq("template_id", data.templateId)
    .in("status", ["pending", "in_progress"])
    .maybeSingle();

  if (existing) return { id: (existing as { id: string }).id };

  const rawItems = (template as any).items as { text: string; required: boolean }[];
  const items: ChecklistItem[] = rawItems.map(item => ({
    id: randomUUID(),
    text: item.text,
    required: item.required,
    checked: false,
  }));

  const { data: created, error } = await supabase
    .from("audit_checklists")
    .insert({
      checklist_date: today,
      checklist_type: (template as any).name,
      shift_type: shiftType,
      status: "in_progress",
      items,
      template_id: data.templateId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/checklists");
  return { id: (created as { id: string }).id };
}

export async function saveChecklistProgress(id: string, items: ChecklistItem[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("audit_checklists")
    .update({ items, status: "in_progress" })
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}

export async function submitChecklist(id: string, items: ChecklistItem[], notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const allRequired = items.filter(i => i.required).every(i => i.checked);
  const status = allRequired ? "completed" : "completed_with_issues";

  const { error } = await supabase
    .from("audit_checklists")
    .update({
      items,
      notes: notes || null,
      status,
      completed_by: user.id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}
