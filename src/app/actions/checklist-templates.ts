"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireManagerRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!["manager", "admin"].includes((profile as any)?.role ?? "")) {
    throw new Error("Insufficient permissions");
  }

  return { supabase, userId: user.id };
}

export async function createTemplate(formData: FormData) {
  const { supabase, userId } = await requireManagerRole();

  const name        = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const category    = formData.get("category") as string;
  const shiftType   = formData.get("shift_type") as string;
  const itemsJson   = formData.get("items") as string;

  if (!name || !category) throw new Error("Name and category are required");

  const items = JSON.parse(itemsJson || "[]") as { text: string; required: boolean }[];
  if (!items.length) throw new Error("At least one item is required");

  const { data: maxOrder } = await supabase
    .from("checklist_templates")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase.from("checklist_templates").insert({
    name,
    description,
    category,
    shift_type: shiftType,
    items,
    sort_order: ((maxOrder as any)?.sort_order ?? 0) + 1,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}

export async function updateTemplate(id: string, formData: FormData) {
  const { supabase } = await requireManagerRole();

  const name        = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const category    = formData.get("category") as string;
  const shiftType   = formData.get("shift_type") as string;
  const itemsJson   = formData.get("items") as string;

  if (!name || !category) throw new Error("Name and category are required");

  const items = JSON.parse(itemsJson || "[]") as { text: string; required: boolean }[];
  if (!items.length) throw new Error("At least one item is required");

  const { error } = await supabase
    .from("checklist_templates")
    .update({ name, description, category, shift_type: shiftType, items, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}

export async function toggleTemplateActive(id: string, isActive: boolean) {
  const { supabase } = await requireManagerRole();

  const { error } = await supabase
    .from("checklist_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}

export async function acknowledgeChecklist(id: string) {
  const { supabase, userId } = await requireManagerRole();

  const { error } = await supabase
    .from("audit_checklists")
    .update({ acknowledged_by: userId, acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["completed", "completed_with_issues"]);

  if (error) throw new Error(error.message);
  revalidatePath("/checklists");
}
