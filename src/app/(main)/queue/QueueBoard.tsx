"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { advanceVisit } from "@/app/actions/visits";
import { WaitTimer } from "@/components/WaitTimer";
import CheckInModal from "./CheckInModal";

type Visit = {
  id: string;
  visit_number: string;
  visit_type: string;
  chief_complaint: string | null;
  status: string;
  priority: string;
  registered_at: string;
  patients: { patient_number: string; full_name: string; date_of_birth: string } | null;
};

const statusConfig: Record<string, { label: string; badge: string; stage: number }> = {
  registered:   { label: "Registered",   badge: "bg-blue-50 text-blue-800 ring-blue-200",       stage: 1 },
  triage:       { label: "Triage",       badge: "bg-amber-50 text-amber-800 ring-amber-200",    stage: 2 },
  lab:          { label: "Lab",          badge: "bg-purple-50 text-purple-800 ring-purple-200", stage: 3 },
  consultation: { label: "Consultation", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", stage: 4 },
  pharmacy:     { label: "Pharmacy",     badge: "bg-teal-50 text-teal-800 ring-teal-200",       stage: 5 },
  completed:    { label: "Completed",    badge: "bg-surface-container text-on-surface-variant ring-outline-variant", stage: 6 },
  cancelled:    { label: "Cancelled",    badge: "bg-red-50 text-red-800 ring-red-200",           stage: 0 },
};

const priorityBadge: Record<string, string> = {
  normal:    "bg-surface-container text-on-surface-variant ring-outline-variant",
  urgent:    "bg-amber-50 text-amber-800 ring-amber-200",
  emergency: "bg-red-50 text-red-800 ring-red-200",
};

const visitTypeLabel: Record<string, string> = {
  walk_in: "Walk-in", appointment: "Appointment",
  pre_employment: "Pre-Employment", iod: "IOD",
  periodic: "Periodic", fitness_for_duty: "Fitness",
};

const nextStatusMap: Record<string, { status: string; label: string }> = {
  registered:   { status: "triage",       label: "→ Triage" },
  triage:       { status: "consultation", label: "→ Consult" },
  lab:          { status: "consultation", label: "→ Consult" },
  consultation: { status: "pharmacy",     label: "→ Pharmacy" },
  pharmacy:     { status: "completed",    label: "→ Complete" },
};

const stages = ["registered", "triage", "lab", "consultation", "pharmacy", "completed"];

interface Props {
  initialVisits: Visit[];
  currentUserRole: string;
}

export default function QueueBoard({ initialVisits, currentUserRole }: Props) {
  const router  = useRouter();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [advancing, setAdvancing]     = useState<string | null>(null);
  const [, startTransition]           = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("queue-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => {
        router.refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [router]);

  function handleAdvance(visitId: string, newStatus: string) {
    setAdvancing(visitId);
    startTransition(async () => {
      try {
        await advanceVisit(visitId, newStatus);
        router.refresh();
      } finally {
        setAdvancing(null);
      }
    });
  }

  const active = initialVisits.filter(v => v.status !== "cancelled");
  const stageCounts = stages.reduce<Record<string, number>>((acc, s) => {
    acc[s] = active.filter(v => v.status === s).length;
    return acc;
  }, {});
  const inProgress = active.filter(v => v.status !== "completed").length;

  const sorted = [...active].sort((a, b) => {
    const pOrder = { emergency: 0, urgent: 1, normal: 2 };
    const pDiff  = (pOrder[a.priority as keyof typeof pOrder] ?? 2) - (pOrder[b.priority as keyof typeof pOrder] ?? 2);
    if (pDiff !== 0) return pDiff;
    return new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
  });

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      {showCheckIn && <CheckInModal onClose={() => setShowCheckIn(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Live Queue</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {inProgress} active · {stageCounts.completed ?? 0} completed today
          </p>
        </div>
        <button
          onClick={() => setShowCheckIn(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Check In Patient
        </button>
      </div>

      {/* Pipeline summary — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 min-w-max md:grid md:grid-cols-6 md:min-w-0">
          {stages.map((s, i) => {
            const cfg   = statusConfig[s];
            const count = stageCounts[s] ?? 0;
            return (
              <div key={s} className="relative shrink-0 w-32 md:w-auto">
                {i > 0 && (
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-10 text-outline-variant text-sm">›</div>
                )}
                <div className={`rounded-lg border px-3 py-3 text-center ${count > 0 ? "border-outline-variant bg-white shadow-sm" : "border-outline-variant/50 bg-surface-container-low"}`}>
                  <p className={`text-xl font-bold font-mono tabular-nums ${count > 0 ? "text-on-surface" : "text-on-surface-variant/40"}`}>
                    {count}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-medium">{cfg.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue — empty state */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-outline-variant bg-white flex flex-col items-center justify-center py-16 text-on-surface-variant shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3 opacity-30">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
          <p className="text-sm font-medium">No patients in queue</p>
          <p className="text-xs mt-1">Click &ldquo;Check In Patient&rdquo; to register the first visit.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-outline-variant bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low">
                    {["#", "Patient", "Type", "Chief Complaint", "Stage", "Wait", "Priority", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {sorted.map(v => {
                    const sc        = statusConfig[v.status] ?? statusConfig.registered;
                    const next      = nextStatusMap[v.status];
                    const isEmergency = v.priority === "emergency";
                    return (
                      <tr key={v.id} className={`transition-colors ${isEmergency ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-surface-container-low"}`}>
                        <td className="px-4 py-3 font-mono text-xs text-on-surface-variant whitespace-nowrap">{v.visit_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-on-surface">{v.patients?.full_name ?? "—"}</p>
                          <p className="text-xs text-on-surface-variant font-mono">{v.patients?.patient_number}</p>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap text-xs">
                          {visitTypeLabel[v.visit_type] ?? v.visit_type}
                        </td>
                        <td className="px-4 py-3 text-on-surface max-w-44">
                          <p className="truncate text-xs">{v.chief_complaint ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${sc.badge}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <WaitTimer registeredAt={v.registered_at} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 capitalize ${priorityBadge[v.priority]}`}>
                            {v.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Link href={`/visits/${v.id}`}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-outline-variant text-on-surface font-medium hover:bg-surface-container transition-colors">
                              View
                            </Link>
                            {next && v.status !== "completed" && (
                              <button
                                onClick={() => handleAdvance(v.id, next.status)}
                                disabled={advancing === v.id}
                                className="px-2.5 py-1.5 text-xs rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                              >
                                {advancing === v.id ? "…" : next.label}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {sorted.map(v => {
              const sc        = statusConfig[v.status] ?? statusConfig.registered;
              const next      = nextStatusMap[v.status];
              const isEmergency = v.priority === "emergency";
              return (
                <div
                  key={v.id}
                  className={`rounded-lg border bg-white p-4 shadow-sm ${isEmergency ? "border-red-200" : "border-outline-variant"}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-on-surface">{v.patients?.full_name ?? "—"}</p>
                      <p className="text-xs text-on-surface-variant font-mono">{v.visit_number}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 shrink-0 ${sc.badge}`}>
                      {sc.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-on-surface-variant mb-2">
                    <span>{visitTypeLabel[v.visit_type] ?? v.visit_type}</span>
                    <span>·</span>
                    <WaitTimer registeredAt={v.registered_at} />
                    <span>·</span>
                    <span className={`font-semibold capitalize ${
                      isEmergency ? "text-red-700" :
                      v.priority === "urgent" ? "text-amber-700" : ""
                    }`}>
                      {v.priority}
                    </span>
                  </div>

                  {v.chief_complaint && (
                    <p className="text-xs text-on-surface mb-3 line-clamp-2">{v.chief_complaint}</p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
                    <Link href={`/visits/${v.id}`}
                      className="flex-1 text-center px-3 py-1.5 text-xs rounded-lg border border-outline-variant text-on-surface font-medium hover:bg-surface-container transition-colors">
                      View Details
                    </Link>
                    {next && v.status !== "completed" && (
                      <button
                        onClick={() => handleAdvance(v.id, next.status)}
                        disabled={advancing === v.id}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors disabled:opacity-50"
                      >
                        {advancing === v.id ? "Advancing…" : next.label}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
