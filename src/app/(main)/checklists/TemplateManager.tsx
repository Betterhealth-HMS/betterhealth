"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import type { ChecklistTemplateRow } from "@/lib/supabase/types";
import { createTemplate, updateTemplate, toggleTemplateActive } from "@/app/actions/checklist-templates";

const CATEGORIES = [
  { value: "safety",     label: "Safety" },
  { value: "medication", label: "Medication" },
  { value: "equipment",  label: "Equipment" },
  { value: "lab",        label: "Lab / QC" },
  { value: "handover",   label: "Handover" },
  { value: "general",    label: "General" },
];

const SHIFTS = [
  { value: "any",       label: "Any shift" },
  { value: "morning",   label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night",     label: "Night" },
];

type TemplateItem = { text: string; required: boolean };

interface Props {
  templates: ChecklistTemplateRow[];
}

export default function TemplateManager({ templates }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistTemplateRow | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const newItemRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setItems(
        editing
          ? (editing.items as TemplateItem[])
          : [{ text: "", required: true }]
      );
      setError(null);
    }
  }, [open, editing]);

  function openNew()                     { setEditing(null); setOpen(true); }
  function openEdit(t: ChecklistTemplateRow) { setEditing(t);   setOpen(true); }
  function close()                       { if (!isPending) { setOpen(false); setEditing(null); } }

  function addItem() {
    setItems(prev => [...prev, { text: "", required: false }]);
    setTimeout(() => newItemRef.current?.focus(), 50);
  }
  function removeItem(i: number)                              { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function updateItemText(i: number, text: string)            { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, text } : it)); }
  function updateItemRequired(i: number, required: boolean)   { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, required } : it)); }
  function moveItem(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = items.filter(it => it.text.trim());
    if (!cleaned.length) { setError("Add at least one item"); return; }
    const formData = new FormData(formRef.current!);
    formData.set("items", JSON.stringify(cleaned));
    startTransition(async () => {
      try {
        if (editing) await updateTemplate(editing.id, formData);
        else         await createTemplate(formData);
        close();
      } catch (err: any) {
        setError(err.message ?? "Failed to save template");
      }
    });
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(() => toggleTemplateActive(id, !current));
  }

  const catLabel = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));
  const shiftLabel = Object.fromEntries(SHIFTS.map(s => [s.value, s.label]));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-on-surface">Checklist Templates</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">{templates.filter(t => t.is_active).length} active templates</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Template
        </button>
      </div>

      {/* Template list */}
      <div className="rounded-lg border border-outline-variant bg-white overflow-hidden">
        {templates.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">No templates yet — create one above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                {["Template", "Category", "Shift", "Items", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {templates.map(t => (
                <tr key={t.id} className={`transition-colors ${t.is_active ? "hover:bg-surface-container-low" : "opacity-50 bg-surface-container/30"}`}>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-on-surface">{t.name}</p>
                    {t.description && <p className="text-xs text-on-surface-variant mt-0.5">{t.description}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-on-surface-variant capitalize">{catLabel[t.category] ?? t.category}</td>
                  <td className="px-4 py-3.5 text-on-surface-variant">{shiftLabel[t.shift_type] ?? t.shift_type}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-on-surface-variant">{(t.items as TemplateItem[]).length}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${t.is_active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-surface-container text-on-surface-variant ring-outline-variant"}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-xs px-2.5 py-1 rounded border border-outline-variant text-on-surface hover:bg-surface-container transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(t.id, t.is_active)}
                        disabled={isPending}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${t.is_active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                      >
                        {t.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl z-10 max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-on-surface">
                {editing ? "Edit Template" : "New Checklist Template"}
              </h2>
              <button onClick={close} disabled={isPending} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Template Name *</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={editing?.name ?? ""}
                    placeholder="e.g. Morning Safety Rounds"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Description</label>
                  <input
                    name="description"
                    type="text"
                    defaultValue={editing?.description ?? ""}
                    placeholder="Brief purpose of this checklist…"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Category + Shift */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Category *</label>
                    <select name="category" required defaultValue={editing?.category ?? "general"} className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Shift</label>
                    <select name="shift_type" defaultValue={editing?.shift_type ?? "any"} className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                      {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Items builder */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-on-surface-variant">Checklist Items *</label>
                    <span className="text-xs text-on-surface-variant">{items.filter(i => i.required).length} required, {items.filter(i => !i.required).length} optional</span>
                  </div>
                  <div className="rounded-lg border border-outline-variant overflow-hidden divide-y divide-outline-variant/50">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-white">
                        {/* Move up/down */}
                        <div className="flex flex-col gap-0.5">
                          <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-0.5 text-on-surface-variant hover:text-on-surface disabled:opacity-25 transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><polyline points="18 15 12 9 6 15" /></svg>
                          </button>
                          <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="p-0.5 text-on-surface-variant hover:text-on-surface disabled:opacity-25 transition-colors">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                        </div>

                        {/* Item text */}
                        <input
                          type="text"
                          value={item.text}
                          onChange={e => updateItemText(i, e.target.value)}
                          ref={i === items.length - 1 ? newItemRef : undefined}
                          placeholder={`Item ${i + 1}…`}
                          className="flex-1 px-2 py-1 text-sm rounded border border-outline-variant/50 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />

                        {/* Required toggle */}
                        <label className="flex items-center gap-1.5 text-xs text-on-surface-variant shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.required}
                            onChange={e => updateItemRequired(i, e.target.checked)}
                            className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5"
                          />
                          Required
                        </label>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          disabled={items.length === 1}
                          className="p-1 text-on-surface-variant hover:text-red-600 disabled:opacity-25 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addItem}
                      className="w-full px-3 py-2.5 text-xs text-primary font-medium hover:bg-primary/5 transition-colors text-left flex items-center gap-2"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add item
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 shrink-0 bg-white rounded-b-xl">
                <button type="button" onClick={close} disabled={isPending} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="px-5 py-2 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {isPending ? "Saving…" : editing ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
