import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, ChecklistTemplateRow } from "@/lib/supabase/types";
import ChecklistBoard from "./ChecklistBoard";
import TemplateManager from "./TemplateManager";
import ManagerReview from "./ManagerReview";

export const metadata: Metadata = { title: "Checklists — BetterHealth" };

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const ALLOWED_ROLES = ["nurse", "doctor", "lab_technician", "pharmacist", "manager", "admin"];
const MANAGER_ROLES = ["manager", "admin"];

export default async function ChecklistsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  const profile   = profileData as Pick<ProfileRow, "role" | "full_name"> | null;
  const role      = profile?.role ?? "receptionist";
  const isManager = MANAGER_ROLES.includes(role);

  if (!ALLOWED_ROLES.includes(role)) redirect("/dashboard");

  const today = new Date().toISOString().split("T")[0];

  // Parallel queries: templates + today's checklists + (manager) completed submissions with staff names
  const [
    { data: allTemplatesRaw, error: tplError },
    { data: activeTemplatesRaw },
    { data: checklistsRaw, error: clError },
    { data: submissionsRaw },
  ] = await Promise.all([
    // All templates for manager CRUD view (active + inactive)
    isManager
      ? supabase.from("checklist_templates").select("*").order("sort_order")
      : Promise.resolve({ data: null, error: null }),
    // Active-only templates for the checklist board
    supabase
      .from("checklist_templates")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("audit_checklists")
      .select("id, checklist_type, shift_type, status, items, notes, completed_at, template_id")
      .eq("checklist_date", today)
      .order("created_at"),
    isManager
      ? supabase
          .from("audit_checklists")
          .select("id, checklist_type, shift_type, status, items, notes, completed_at, acknowledged_at, acknowledged_by, completed_by, profiles!audit_checklists_completed_by_fkey(full_name)")
          .eq("checklist_date", today)
          .in("status", ["completed", "completed_with_issues"])
          .order("completed_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const hasTable       = !clError && !tplError;
  const allTemplates   = (allTemplatesRaw  as unknown as ChecklistTemplateRow[]) ?? [];
  const templates      = (activeTemplatesRaw as unknown as ChecklistTemplateRow[]) ?? [];
  const checklists     = (checklistsRaw as unknown as any[]) ?? [];
  const rawSubmissions = (submissionsRaw as unknown as any[]) ?? [];

  // Resolve acknowledged_by names separately if needed
  const acknowledgedByIds = rawSubmissions
    .filter(s => s.acknowledged_by)
    .map(s => s.acknowledged_by as string);

  let acknowledgedByNames: Record<string, string> = {};
  if (acknowledgedByIds.length) {
    const { data: ackProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(acknowledgedByIds)]);
    for (const p of (ackProfiles ?? []) as any[]) {
      acknowledgedByNames[p.id] = p.full_name;
    }
  }

  const submissions = rawSubmissions.map(s => ({
    id:                   s.id,
    checklist_type:       s.checklist_type,
    shift_type:           s.shift_type,
    status:               s.status,
    items:                s.items,
    notes:                s.notes,
    completed_at:         s.completed_at,
    acknowledged_at:      s.acknowledged_at,
    completed_by_name:    (s.profiles as any)?.full_name ?? null,
    acknowledged_by_name: s.acknowledged_by ? (acknowledgedByNames[s.acknowledged_by] ?? null) : null,
  }));

  const completed  = checklists.filter(c => c.status === "completed").length;
  const withIssues = checklists.filter(c => c.status === "completed_with_issues").length;
  const inProgress = checklists.filter(c => c.status === "in_progress").length;
  const notStarted = Math.max(0, templates.length - completed - withIssues - inProgress);

  const summaryCards = [
    { label: "Completed",   value: completed,  color: "text-emerald-700" },
    { label: "With Issues", value: withIssues, color: "text-orange-700" },
    { label: "In Progress", value: inProgress, color: "text-amber-700" },
    { label: "Not Started", value: notStarted, color: "text-on-surface-variant" },
  ];

  const shiftNow = new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Night";

  return (
    <main className="flex-1 p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-on-surface">Audit Checklists</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full ring-1 ring-outline-variant">
          Current shift: {shiftNow}
        </span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map(c => (
          <div key={c.label} className="rounded-lg border border-outline-variant bg-white px-5 py-4 shadow-sm">
            <p className={`text-2xl font-bold font-mono tabular-nums ${c.color}`}>{c.value}</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      {/* DB not set up warning */}
      {!hasTable && (
        <div className="flex items-start gap-3 px-4 py-4 rounded-lg border border-amber-200 bg-amber-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-amber-700 shrink-0 mt-0.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Database tables not yet created</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Run the checklist SQL migration in your Supabase SQL Editor to enable this module.
            </p>
          </div>
        </div>
      )}

      {/* Manager sections */}
      {isManager && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-outline-variant" />
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Manager Tools</span>
            <div className="h-px flex-1 bg-outline-variant" />
          </div>

          {/* Template Manager */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
            <TemplateManager templates={allTemplates} />
          </div>

          {/* Review completed submissions */}
          {submissions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-on-surface">Today's Submissions — Review &amp; Acknowledge</h2>
              <ManagerReview submissions={submissions as any} />
            </div>
          )}
        </section>
      )}

      {/* Clinical staff checklist board */}
      <section className="space-y-4">
        {isManager && (
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-outline-variant" />
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">My Checklists</span>
            <div className="h-px flex-1 bg-outline-variant" />
          </div>
        )}
        <ChecklistBoard existingChecklists={checklists} templates={templates} />
      </section>
    </main>
  );
}
