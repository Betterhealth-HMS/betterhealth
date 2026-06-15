"use client";

import { useState, useTransition } from "react";
import type { ChecklistItem, ChecklistTemplateRow } from "@/lib/supabase/types";
import { startChecklist, saveChecklistProgress, submitChecklist } from "@/app/actions/checklists";

interface ChecklistRow {
  id: string;
  checklist_type: string;
  shift_type: string;
  status: "pending" | "in_progress" | "completed" | "completed_with_issues";
  items: ChecklistItem[];
  notes: string | null;
  completed_at: string | null;
  template_id: string | null;
}

const STATUS_META = {
  pending:               { label: "Not Started",  color: "text-on-surface-variant", bg: "bg-surface-container",  dot: "bg-outline" },
  in_progress:           { label: "In Progress",  color: "text-amber-700",          bg: "bg-amber-50",           dot: "bg-amber-500" },
  completed:             { label: "Completed",     color: "text-emerald-700",        bg: "bg-emerald-50",         dot: "bg-emerald-500" },
  completed_with_issues: { label: "Issues Noted", color: "text-orange-700",         bg: "bg-orange-50",          dot: "bg-orange-500" },
};

function detectShift(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "night";
}

interface Props {
  existingChecklists: ChecklistRow[];
  templates: ChecklistTemplateRow[];
}

export default function ChecklistBoard({ existingChecklists, templates }: Props) {
  const [activeChecklist, setActiveChecklist] = useState<{
    id: string;
    templateName: string;
    templateDescription: string | null;
    items: ChecklistItem[];
    notes: string;
  } | null>(null);
  const [viewCompleted, setViewCompleted] = useState<ChecklistRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function findExisting(templateId: string) {
    return existingChecklists.find(c => c.template_id === templateId);
  }

  function handleStart(template: ChecklistTemplateRow) {
    setError(null);
    const existing = findExisting(template.id);
    if (existing?.status === "in_progress") {
      setActiveChecklist({
        id: existing.id,
        templateName: template.name,
        templateDescription: template.description,
        items: existing.items,
        notes: existing.notes ?? "",
      });
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await startChecklist({ templateId: template.id, shiftType: detectShift() });
        // Re-fetch items from the existing checklist by re-reading local state — the server has them now
        // The page will revalidate; for immediate UX use the template items as initial state
        const rawItems = template.items as { text: string; required: boolean }[];
        const items: ChecklistItem[] = rawItems.map((it, idx) => ({
          id: `${template.id}-${idx}`,
          text: it.text,
          required: it.required,
          checked: false,
        }));
        setActiveChecklist({ id, templateName: template.name, templateDescription: template.description, items, notes: "" });
      } catch (err: any) {
        setError(err.message ?? "Failed to start checklist");
      }
    });
  }

  function toggleItem(itemId: string) {
    if (!activeChecklist) return;
    setActiveChecklist(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i),
    } : null);
  }

  function setItemNote(itemId: string, notes: string) {
    if (!activeChecklist) return;
    setActiveChecklist(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, notes } : i),
    } : null);
  }

  function handleSave() {
    if (!activeChecklist) return;
    startTransition(async () => {
      try {
        await saveChecklistProgress(activeChecklist.id, activeChecklist.items);
        setSaveMsg("Progress saved");
        setTimeout(() => setSaveMsg(null), 2000);
      } catch (err: any) {
        setError(err.message ?? "Save failed");
      }
    });
  }

  function handleSubmit() {
    if (!activeChecklist) return;
    startTransition(async () => {
      try {
        await submitChecklist(activeChecklist.id, activeChecklist.items, activeChecklist.notes);
        setActiveChecklist(null);
      } catch (err: any) {
        setError(err.message ?? "Submit failed");
      }
    });
  }

  const checkedCount    = activeChecklist?.items.filter(i => i.checked).length ?? 0;
  const requiredCount   = activeChecklist?.items.filter(i => i.required).length ?? 0;
  const requiredChecked = activeChecklist?.items.filter(i => i.required && i.checked).length ?? 0;
  const progress        = activeChecklist ? Math.round((checkedCount / activeChecklist.items.length) * 100) : 0;

  // ── Active checklist view ──────────────────────────────────────────────────
  if (activeChecklist) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveChecklist(null); setError(null); }}
              className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-on-surface">{activeChecklist.templateName}</h2>
              {activeChecklist.templateDescription && (
                <p className="text-xs text-on-surface-variant">{activeChecklist.templateDescription}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-xs text-emerald-700 font-medium">{saveMsg}</span>}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Progress"}
            </button>
          </div>
        </div>

        {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <div className="rounded-lg border border-outline-variant bg-white p-4">
          <div className="flex items-center justify-between text-xs text-on-surface-variant mb-2">
            <span>{checkedCount} of {activeChecklist.items.length} items checked</span>
            <span className="font-semibold">{requiredChecked}/{requiredCount} required</span>
          </div>
          <div className="h-2 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-white divide-y divide-outline-variant/50 overflow-hidden">
          {activeChecklist.items.map(item => (
            <div key={item.id} className={`p-4 transition-colors ${item.checked ? "bg-emerald-50/30" : ""}`}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    item.checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-outline hover:border-primary"
                  }`}
                >
                  {item.checked && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.checked ? "line-through text-on-surface-variant" : "text-on-surface"}`}>
                    {item.text}
                    {item.required && <span className="ml-1 text-xs text-red-500">*</span>}
                  </p>
                  <input
                    type="text"
                    value={item.notes ?? ""}
                    onChange={e => setItemNote(item.id, e.target.value)}
                    placeholder="Add note (optional)…"
                    className="mt-1.5 w-full text-xs px-2 py-1.5 rounded border border-outline-variant/50 bg-white placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-outline-variant bg-white p-4">
          <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Completion Notes / Handover Comments</label>
          <textarea
            value={activeChecklist.notes}
            onChange={e => setActiveChecklist(prev => prev ? { ...prev, notes: e.target.value } : null)}
            rows={2}
            placeholder="Any issues, follow-up actions, or notes for the next shift…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-on-surface-variant">
            {requiredChecked < requiredCount
              ? `⚠ ${requiredCount - requiredChecked} required item${requiredCount - requiredChecked > 1 ? "s" : ""} unchecked — will be flagged`
              : "✓ All required items checked"}
          </p>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Submitting…" : "Submit Checklist"}
          </button>
        </div>
      </div>
    );
  }

  // ── Completed checklist read-only view ─────────────────────────────────────
  if (viewCompleted) {
    const meta = STATUS_META[viewCompleted.status];
    const tmpl = templates.find(t => t.id === viewCompleted.template_id);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewCompleted(null)} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-semibold text-on-surface">
              {tmpl?.name ?? viewCompleted.checklist_type}
            </h2>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />{meta.label}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-white divide-y divide-outline-variant/50 overflow-hidden">
          {viewCompleted.items.map(item => (
            <div key={item.id} className={`px-4 py-3 flex items-start gap-3 ${!item.checked && item.required ? "bg-orange-50/30" : ""}`}>
              <div className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${item.checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-red-400"}`}>
                {item.checked && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-2.5 h-2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm ${!item.checked ? "text-on-surface" : "text-on-surface-variant"}`}>
                  {item.text}
                  {item.required && !item.checked && <span className="ml-1 text-xs text-red-500">*</span>}
                </p>
                {item.notes && <p className="text-xs text-on-surface-variant mt-0.5 italic">"{item.notes}"</p>}
              </div>
            </div>
          ))}
        </div>

        {viewCompleted.notes && (
          <div className="rounded-lg border border-outline-variant bg-white p-4">
            <p className="text-xs font-semibold text-on-surface-variant mb-1">Completion Notes</p>
            <p className="text-sm text-on-surface">{viewCompleted.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Template grid (default view) ─────────────────────────────────────────
  if (!templates.length) {
    return (
      <div className="rounded-lg border border-outline-variant bg-white p-8 text-center text-sm text-on-surface-variant shadow-sm">
        No active checklist templates. Ask a manager to create templates in the Templates section.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map(template => {
          const existing = findExisting(template.id);
          const status   = existing?.status ?? "pending";
          const meta     = STATUS_META[status];
          const completedCount = existing?.items.filter(i => i.checked).length ?? 0;
          const totalCount     = existing ? existing.items.length : (template.items as any[]).length;

          return (
            <div key={template.id} className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{template.name}</p>
                  {template.description && (
                    <p className="text-xs text-on-surface-variant mt-0.5">{template.description}</p>
                  )}
                  <p className="text-xs text-on-surface-variant mt-1 capitalize">{template.category} · {template.shift_type === "any" ? "Any shift" : template.shift_type}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${meta.bg} ${meta.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              </div>

              {existing && (
                <div>
                  <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                    <span>{completedCount}/{totalCount} items</span>
                    {existing.completed_at && (
                      <span>{new Date(existing.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${status === "completed" ? "bg-emerald-500" : status === "completed_with_issues" ? "bg-orange-500" : "bg-primary"}`}
                      style={{ width: `${totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-auto">
                {status === "pending" && (
                  <button
                    onClick={() => handleStart(template)}
                    disabled={isPending}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Starting…" : "Start Checklist"}
                  </button>
                )}
                {status === "in_progress" && (
                  <button
                    onClick={() => handleStart(template)}
                    disabled={isPending}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    Resume
                  </button>
                )}
                {(status === "completed" || status === "completed_with_issues") && (
                  <button
                    onClick={() => setViewCompleted(existing!)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container transition-colors"
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-on-surface-variant">
        * Required items must be checked for a clean completion. Unchecked required items are flagged as issues.
      </p>
    </div>
  );
}
