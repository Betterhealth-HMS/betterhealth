"use client";

import { useState, useTransition } from "react";
import type { ChecklistItem } from "@/lib/supabase/types";
import { acknowledgeChecklist } from "@/app/actions/checklist-templates";

interface Submission {
  id: string;
  checklist_type: string;
  shift_type: string;
  status: "completed" | "completed_with_issues";
  items: ChecklistItem[];
  notes: string | null;
  completed_at: string | null;
  acknowledged_at: string | null;
  completed_by_name: string | null;
  acknowledged_by_name: string | null;
}

interface Props {
  submissions: Submission[];
}

const STATUS_META = {
  completed:             { label: "Completed",    cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  completed_with_issues: { label: "Issues Noted", cls: "bg-orange-50 text-orange-800 ring-orange-200",  dot: "bg-orange-500" },
};

export default function ManagerReview({ submissions }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unacknowledged = submissions.filter(s => !s.acknowledged_at);
  const acknowledged   = submissions.filter(s =>  s.acknowledged_at);

  function handleAcknowledge(id: string) {
    startTransition(() => acknowledgeChecklist(id));
  }

  function SubmissionCard({ s }: { s: Submission }) {
    const meta     = STATUS_META[s.status];
    const checked  = s.items.filter(i => i.checked).length;
    const total    = s.items.length;
    const required = s.items.filter(i => i.required).length;
    const reqDone  = s.items.filter(i => i.required && i.checked).length;
    const isExp    = expanded === s.id;

    return (
      <div className={`rounded-lg border bg-white shadow-sm overflow-hidden ${s.status === "completed_with_issues" ? "border-orange-200" : "border-outline-variant"}`}>
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-on-surface">{s.checklist_type}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${meta.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                <span className="text-xs text-on-surface-variant capitalize px-2 py-0.5 rounded-full bg-surface-container ring-1 ring-outline-variant">
                  {s.shift_type}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-on-surface-variant flex-wrap">
                <span>By: <span className="font-medium text-on-surface">{s.completed_by_name ?? "Unknown"}</span></span>
                {s.completed_at && (
                  <span>At: <span className="font-mono">{new Date(s.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></span>
                )}
                <span>{checked}/{total} items checked · {reqDone}/{required} required</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setExpanded(isExp ? null : s.id)}
                className="text-xs px-3 py-1.5 rounded border border-outline-variant text-on-surface hover:bg-surface-container transition-colors"
              >
                {isExp ? "Collapse" : "View Items"}
              </button>
              {!s.acknowledged_at && (
                <button
                  onClick={() => handleAcknowledge(s.id)}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Acknowledge
                </button>
              )}
              {s.acknowledged_at && (
                <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Acknowledged
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${s.status === "completed_with_issues" ? "bg-orange-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.round((checked / total) * 100)}%` }}
            />
          </div>
        </div>

        {/* Expanded items */}
        {isExp && (
          <div className="border-t border-outline-variant divide-y divide-outline-variant/50">
            {s.items.map(item => (
              <div key={item.id} className={`px-5 py-2.5 flex items-start gap-3 ${!item.checked && item.required ? "bg-orange-50/40" : ""}`}>
                <div className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${item.checked ? "bg-emerald-500 border-emerald-500 text-white" : "border-outline-variant"}`}>
                  {item.checked && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-2.5 h-2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${item.checked ? "text-on-surface-variant" : "text-on-surface font-medium"}`}>
                    {item.text}
                    {item.required && !item.checked && <span className="ml-1 text-red-500">*</span>}
                  </p>
                  {item.notes && <p className="text-xs text-on-surface-variant italic mt-0.5">"{item.notes}"</p>}
                </div>
              </div>
            ))}
            {s.notes && (
              <div className="px-5 py-3 bg-surface-container-low">
                <p className="text-xs font-semibold text-on-surface-variant mb-0.5">Completion Notes</p>
                <p className="text-xs text-on-surface">{s.notes}</p>
              </div>
            )}
            {s.acknowledged_at && (
              <div className="px-5 py-3 bg-emerald-50/30 border-t border-emerald-100">
                <p className="text-xs text-emerald-700">
                  Acknowledged by <span className="font-medium">{s.acknowledged_by_name ?? "manager"}</span> at {new Date(s.acknowledged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="rounded-lg border border-outline-variant bg-white p-8 text-center text-sm text-on-surface-variant shadow-sm">
        No completed checklists to review yet today.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unacknowledged.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Awaiting Acknowledgment ({unacknowledged.length})
          </h3>
          {unacknowledged.map(s => <SubmissionCard key={s.id} s={s} />)}
        </div>
      )}
      {acknowledged.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Acknowledged ({acknowledged.length})
          </h3>
          {acknowledged.map(s => <SubmissionCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}
