import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import AddInventoryModal from "./AddInventoryModal";
import StockUpdateForm from "./StockUpdateForm";

type InventoryItem = Database["public"]["Tables"]["inventory"]["Row"];
type ProfileRow    = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = { title: "Inventory — BetterHealth" };

const categoryLabel: Record<string, string> = {
  medication: "Medication", consumable: "Consumable",
  equipment: "Equipment", lab_reagent: "Lab Reagent", vaccine: "Vaccine",
};

const ALLOWED_ROLES = ["pharmacist", "manager", "admin"];

export default async function InventoryPage() {
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

  const { data: itemsData } = await supabase.from("inventory").select("*").order("item_name");
  const items = itemsData as InventoryItem[] | null;

  const lowStock = items?.filter(i => i.current_stock <= i.reorder_level) ?? [];

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Inventory</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {items?.length ?? 0} items &middot; {lowStock.length} below reorder level
          </p>
        </div>
        <AddInventoryModal />
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-amber-700 shrink-0 mt-0.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">{lowStock.length} item{lowStock.length > 1 ? "s" : ""} at or below reorder level</p>
            <p className="text-xs text-amber-700 mt-0.5">{lowStock.map(i => i.item_name).join(", ")}</p>
          </div>
        </div>
      )}

      {/* Inventory table */}
      {!items || items.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-white p-12 flex flex-col items-center justify-center text-on-surface-variant shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mb-4 opacity-25">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <p className="text-sm font-medium">No inventory items</p>
          <p className="text-xs mt-1 opacity-70">Add your first item using the button above.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-outline-variant bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {["Code", "Item", "Category", "Location", "Stock", "Reorder At", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {items?.map(item => {
                  const isLow      = item.current_stock <= item.reorder_level;
                  const isCritical = item.current_stock === 0;
                  return (
                    <tr key={item.id} className={`transition-colors ${isCritical ? "bg-red-50/40" : isLow ? "bg-amber-50/30" : "hover:bg-surface-container-low"}`}>
                      <td className="px-5 py-3.5 font-mono text-xs text-on-surface-variant">{item.item_code ?? "—"}</td>
                      <td className="px-5 py-3.5 font-medium text-on-surface">{item.item_name}</td>
                      <td className="px-5 py-3.5 text-on-surface-variant">{categoryLabel[item.category] ?? item.category}</td>
                      <td className="px-5 py-3.5 text-on-surface-variant">{item.location ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <div className={isCritical ? "text-red-700" : isLow ? "text-amber-700" : "text-on-surface"}>
                          <StockUpdateForm id={item.id} current={item.current_stock} unit={item.unit} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-on-surface-variant">{item.reorder_level}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${
                          isCritical ? "bg-red-50 text-red-800 ring-red-200" :
                          isLow ? "bg-amber-50 text-amber-800 ring-amber-200" :
                          "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        }`}>
                          {isCritical ? "Out of Stock" : isLow ? "Low Stock" : "Adequate"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
