import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import ChecklistBoard from "./ChecklistBoard";

export const metadata: Metadata = { title: "Checklists — BetterHealth" };

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const ALLOWED_ROLES = ["nurse", "doctor", "lab_technician", "pharmacist", "manager", "admin"];

export default async function ChecklistsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<ProfileRow, "role" | "full_name"> | null;
  const role = profile?.role ?? "receptionist";

  if (!ALLOWED_ROLES.includes(role)) redirect("/dashboard");

  const today = new Date().toISOString().split("T")[0];

  const { data: checklistsRaw, error: clError } = await supabase
    .from("audit_checklists")
    .select("id, checklist_type, shift_type, status, items, notes, completed_at")
    .eq("checklist_date", today)
    .order("created_at");

  const hasTable = !clError;
  const checklists = (checklistsRaw as unknown as any[]) ?? [];

  const completed   = checklists.filter(c => c.status === "completed").length;
  const withIssues  = checklists.filter(c => c.status === "completed_with_issues").length;
  const inProgress  = checklists.filter(c => c.status === "in_progress").length;
  const notStarted  = 5 - completed - withIssues - inProgress;

  const summaryCards = [
    { label: "Completed",     value: completed,   color: "text-emerald-700" },
    { label: "With Issues",   value: withIssues,  color: "text-orange-700" },
    { label: "In Progress",   value: inProgress,  color: "text-amber-700" },
    { label: "Not Started",   value: notStarted > 0 ? notStarted : 0, color: "text-on-surface-variant" },
  ];

  return (
    <main className="flex-1 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Audit Checklists</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full ring-1 ring-outline-variant">
          Shift: {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Night"}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map(c => (
          <div key={c.label} className="rounded-lg border border-outline-variant bg-white px-5 py-4 shadow-sm">
            <p className={`text-2xl font-bold font-mono tabular-nums ${c.color}`}>{c.value}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Table not set up warning */}
      {!hasTable && (
        <div className="flex items-start gap-3 px-4 py-4 rounded-lg border border-amber-200 bg-amber-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-amber-700 shrink-0 mt-0.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Database table not yet created</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Run the <code className="font-mono bg-amber-100 px-1 rounded">audit_checklists</code> SQL migration in your Supabase SQL Editor to enable checklists.
            </p>
          </div>
        </div>
      )}

      {/* Checklist board */}
      <ChecklistBoard existingChecklists={checklists} />
    </main>
  );
}
