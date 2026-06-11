"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPrescription, dispensePrescription } from "@/app/actions/visits";

type Item = { medication_name: string; dosage: string; frequency: string; duration?: string | null; quantity?: number | null; instructions?: string | null; is_dispensed: boolean };
type Prescription = { id: string; status: string; prescribed_at: string; prescription_items: Item[] };

interface Props {
  visitId: string;
  prescriptions: Prescription[];
  canPrescribe: boolean;
  canDispense: boolean;
}

const blankItem = () => ({ medicationName: "", dosage: "", frequency: "", duration: "", quantity: "", instructions: "" });

export default function PrescriptionSection({ visitId, prescriptions, canPrescribe, canDispense }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState([blankItem()]);

  function addItem() { setItems(i => [...i, blankItem()]); }
  function removeItem(idx: number) { setItems(i => i.filter((_, j) => j !== idx)); }
  function updateItem(idx: number, key: string, val: string) {
    setItems(i => i.map((it, j) => j === idx ? { ...it, [key]: val } : it));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await createPrescription(visitId, items.map(it => ({
          medicationName: it.medicationName,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration || undefined,
          quantity: it.quantity ? parseInt(it.quantity) : undefined,
          instructions: it.instructions || undefined,
        })));
        setItems([blankItem()]);
        setShowForm(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save prescription");
      }
    });
  }

  function handleDispense(prescriptionId: string) {
    startTransition(async () => {
      try {
        await dispensePrescription(prescriptionId, visitId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to dispense");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Existing prescriptions */}
      {prescriptions.length === 0 && !showForm && (
        <p className="text-sm text-on-surface-variant text-center py-4">No prescriptions for this visit yet.</p>
      )}

      {prescriptions.map(rx => (
        <div key={rx.id} className="rounded-lg border border-outline-variant overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${
                rx.status === "dispensed" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" :
                rx.status === "pending" ? "bg-amber-50 text-amber-800 ring-amber-200" :
                "bg-surface-container text-on-surface-variant ring-outline-variant"
              }`}>{rx.status === "dispensed" ? "Dispensed" : "Pending"}</span>
              <span className="text-xs text-on-surface-variant font-mono">{new Date(rx.prescribed_at).toLocaleString()}</span>
            </div>
            {canDispense && rx.status === "pending" && (
              <button onClick={() => handleDispense(rx.id)} disabled={isPending}
                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {isPending ? "…" : "Mark Dispensed"}
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-on-surface-variant bg-white">
                {["Medication", "Dosage", "Frequency", "Duration", "Qty", "Instructions"].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rx.prescription_items.map((it, i) => (
                <tr key={i} className={it.is_dispensed ? "opacity-60" : ""}>
                  <td className="px-4 py-2.5 font-medium text-on-surface">{it.medication_name}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{it.dosage}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{it.frequency}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{it.duration ?? "—"}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{it.quantity ?? "—"}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant text-xs">{it.instructions ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Add prescription form */}
      {canPrescribe && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Prescription
        </button>
      )}

      {canPrescribe && showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-outline-variant overflow-hidden">
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant">
            <p className="text-sm font-semibold text-on-surface">New Prescription</p>
          </div>
          <div className="p-4 space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-6 gap-2 items-start p-3 rounded-lg border border-outline-variant bg-surface-container-low/50">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-on-surface-variant">Medication *</label>
                  <input value={it.medicationName} onChange={e => updateItem(idx, "medicationName", e.target.value)} required
                    placeholder="e.g. Amoxicillin 500mg"
                    className="mt-1 w-full px-2 py-1.5 text-sm rounded border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">Dosage *</label>
                  <input value={it.dosage} onChange={e => updateItem(idx, "dosage", e.target.value)} required
                    placeholder="500mg"
                    className="mt-1 w-full px-2 py-1.5 text-sm rounded border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">Frequency *</label>
                  <input value={it.frequency} onChange={e => updateItem(idx, "frequency", e.target.value)} required
                    placeholder="3x daily"
                    className="mt-1 w-full px-2 py-1.5 text-sm rounded border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">Duration</label>
                  <input value={it.duration} onChange={e => updateItem(idx, "duration", e.target.value)}
                    placeholder="7 days"
                    className="mt-1 w-full px-2 py-1.5 text-sm rounded border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex items-end gap-1">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Qty</label>
                    <input type="number" value={it.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)}
                      placeholder="21"
                      className="mt-1 w-full px-2 py-1.5 text-sm rounded border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)}
                      className="mb-0.5 p-1.5 text-red-500 hover:text-red-700 transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6m4-6v6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button type="button" onClick={addItem}
              className="text-xs text-primary font-medium hover:underline">
              + Add another medication
            </button>
          </div>

          {error && <p className="mx-4 mb-3 text-xs text-error bg-error-container/30 border border-error/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 px-4 pb-4">
            <button type="button" onClick={() => { setShowForm(false); setItems([blankItem()]); }}
              className="px-4 py-2 rounded-lg border border-outline-variant text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="px-5 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-50">
              {isPending ? "Saving…" : "Save Prescription"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
