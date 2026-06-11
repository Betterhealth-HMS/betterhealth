"use client";

import { useState, useTransition, useRef } from "react";
import { createInventoryItem } from "@/app/actions/inventory";

const CATEGORIES = [
  { value: "medication",  label: "Medication" },
  { value: "consumable",  label: "Consumable" },
  { value: "equipment",   label: "Equipment" },
  { value: "lab_reagent", label: "Lab Reagent" },
  { value: "vaccine",     label: "Vaccine" },
];

export default function AddInventoryModal() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setSuccess(false);
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      try {
        await createInventoryItem(formData);
        setSuccess(true);
        setTimeout(close, 1000);
      } catch (err: any) {
        setError(err.message ?? "Failed to add item");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Item
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Add Inventory Item</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">Fill in item details below</p>
              </div>
              <button onClick={close} disabled={isPending} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6 text-emerald-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-on-surface">Item added to inventory</p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {error && (
                  <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
                )}

                {/* Name + Code */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Item Name *</label>
                    <input name="item_name" type="text" required placeholder="e.g. Paracetamol 500mg"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Item Code</label>
                    <input name="item_code" type="text" placeholder="MED-001"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                {/* Category + Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Category *</label>
                    <select name="category" required className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Unit *</label>
                    <input name="unit" type="text" required placeholder="tablets, ml, units…"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                {/* Stock + Reorder */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Current Stock *</label>
                    <input name="current_stock" type="number" required min={0} defaultValue={0}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Reorder Level *</label>
                    <input name="reorder_level" type="number" required min={0} defaultValue={10}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                {/* Location + Supplier */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Location</label>
                    <input name="location" type="text" placeholder="Pharmacy shelf A2…"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Supplier</label>
                    <input name="supplier" type="text" placeholder="Supplier name…"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                {/* Unit cost + Expiry */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Unit Cost (R)</label>
                    <input name="unit_cost" type="number" step="0.01" min={0} placeholder="0.00"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Expiry Date</label>
                    <input name="expiry_date" type="date"
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant">
                  <button type="button" onClick={close} disabled={isPending} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "Adding…" : "Add to Inventory"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
