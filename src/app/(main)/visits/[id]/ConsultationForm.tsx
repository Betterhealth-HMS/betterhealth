"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveConsultation } from "@/app/actions/visits";

type NoteRow = {
  subjective?: string | null; objective?: string | null;
  assessment?: string | null; plan?: string | null;
  diagnosis_code?: string | null; diagnosis_description?: string | null;
  follow_up_required?: boolean | null; follow_up_date?: string | null;
  follow_up_instructions?: string | null;
  work_status?: string | null;
};

interface Props {
  visitId: string;
  existing?: NoteRow | null;
}

export default function ConsultationForm({ visitId, existing }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    subjective: existing?.subjective ?? "",
    objective: existing?.objective ?? "",
    assessment: existing?.assessment ?? "",
    plan: existing?.plan ?? "",
    diagnosisCode: existing?.diagnosis_code ?? "",
    diagnosisDescription: existing?.diagnosis_description ?? "",
    followUpRequired: existing?.follow_up_required ?? false,
    followUpDate: existing?.follow_up_date ?? "",
    followUpInstructions: existing?.follow_up_instructions ?? "",
    workStatus: existing?.work_status ?? "",
  });

  function set(key: keyof typeof form, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      try {
        await saveConsultation(visitId, {
          subjective: form.subjective || undefined,
          objective: form.objective || undefined,
          assessment: form.assessment || undefined,
          plan: form.plan || undefined,
          diagnosisCode: form.diagnosisCode || undefined,
          diagnosisDescription: form.diagnosisDescription || undefined,
          followUpRequired: form.followUpRequired,
          followUpDate: form.followUpDate || undefined,
          followUpInstructions: form.followUpInstructions || undefined,
          workStatus: form.workStatus || undefined,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save notes");
      }
    });
  }

  const soap = [
    { key: "subjective" as const, label: "S — Subjective", placeholder: "Patient's description of their complaint and symptoms…" },
    { key: "objective" as const, label: "O — Objective", placeholder: "Physical examination findings, observations, test results…" },
    { key: "assessment" as const, label: "A — Assessment", placeholder: "Diagnosis, clinical impression…" },
    { key: "plan" as const, label: "P — Plan", placeholder: "Treatment plan, referrals, medications, lifestyle advice…" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* SOAP */}
      <div className="grid grid-cols-1 gap-4">
        {soap.map(s => (
          <div key={s.key}>
            <label className="text-xs font-semibold text-on-surface-variant">{s.label}</label>
            <textarea value={form[s.key]} onChange={e => set(s.key, e.target.value)}
              rows={3} placeholder={s.placeholder}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
        ))}
      </div>

      {/* Diagnosis */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-on-surface-variant">ICD-10 Code</label>
          <input value={form.diagnosisCode} onChange={e => set("diagnosisCode", e.target.value)}
            placeholder="e.g. J06.9"
            className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-on-surface-variant">Diagnosis Description</label>
          <input value={form.diagnosisDescription} onChange={e => set("diagnosisDescription", e.target.value)}
            placeholder="e.g. Acute upper respiratory tract infection"
            className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* OHN: Work status */}
      <div>
        <label className="text-xs font-semibold text-on-surface-variant">Occupational Fitness Status</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { value: "fit", label: "Fit for Duty", cls: "text-emerald-700 border-emerald-300 bg-emerald-50" },
            { value: "fit_with_restrictions", label: "Fit with Restrictions", cls: "text-amber-700 border-amber-300 bg-amber-50" },
            { value: "temporarily_unfit", label: "Temporarily Unfit", cls: "text-orange-700 border-orange-300 bg-orange-50" },
            { value: "unfit", label: "Unfit", cls: "text-red-700 border-red-300 bg-red-50" },
          ].map(o => (
            <button key={o.value} type="button"
              onClick={() => set("workStatus", form.workStatus === o.value ? "" : o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.workStatus === o.value ? o.cls + " ring-2 ring-offset-1 ring-current" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Follow-up */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.followUpRequired}
            onChange={e => set("followUpRequired", e.target.checked)}
            className="w-4 h-4 rounded border-outline-variant text-primary accent-primary" />
          <span className="text-sm font-medium text-on-surface">Follow-up required</span>
        </label>
        {form.followUpRequired && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">Follow-up Date</label>
              <input type="date" value={form.followUpDate} onChange={e => set("followUpDate", e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant">Follow-up Instructions</label>
              <input value={form.followUpInstructions} onChange={e => set("followUpInstructions", e.target.value)}
                placeholder="e.g. Return if symptoms worsen"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-error bg-error-container/30 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
      {saved && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Consultation notes saved.</p>}

      <button type="submit" disabled={isPending}
        className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-50">
        {isPending ? "Saving…" : "Save Consultation Notes"}
      </button>
    </form>
  );
}
