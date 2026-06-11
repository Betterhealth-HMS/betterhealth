"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createInventoryItem(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const itemName    = formData.get("item_name") as string;
  const category    = formData.get("category") as string;
  const unit        = formData.get("unit") as string;
  const stock       = parseInt(formData.get("current_stock") as string) || 0;
  const reorder     = parseInt(formData.get("reorder_level") as string) || 0;
  const itemCode    = (formData.get("item_code") as string) || null;
  const location    = (formData.get("location") as string) || null;
  const unitCost    = parseFloat(formData.get("unit_cost") as string) || null;
  const supplier    = (formData.get("supplier") as string) || null;
  const expiryDate  = (formData.get("expiry_date") as string) || null;

  if (!itemName || !category || !unit) throw new Error("Missing required fields");

  const { error } = await supabase.from("inventory").insert({
    item_name: itemName,
    category: category as any,
    unit,
    current_stock: stock,
    reorder_level: reorder,
    item_code: itemCode,
    location,
    unit_cost: unitCost,
    supplier,
    expiry_date: expiryDate || null,
    updated_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function updateInventoryStock(id: string, newStock: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("inventory")
    .update({ current_stock: newStock, updated_by: user.id })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}
