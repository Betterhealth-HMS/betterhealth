"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordVitals } from "@/app/actions/visits";

interface Props {
  visitId: string;
}

export default function VitalsForm({ visitId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    bpSystolic: "", bpDiastolic: "", pulseRate: "", temperature: "",
    weightKg: "", heightCm: "", oxygenSaturation: "", respiratoryRate: "",
    bloodGlucose: "", painScale: "", notes: "",
  });

  const bmi = form.weightKg && form.heightCm
    ? (parseFloat(form.weightKg) / Math.pow(parseFloat(form.heightCm) / 100, 2)).toFixed(1)
    : null;

  function n(s: string) { return s ? parseFloat(s) : null; }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      try {
        await recordVitals(visitId, {
          bpSystolic: n(form.bpSystolic) ? parseInt(form.bpSystolic) : null,
          bpDiastolic: n(form.bpDiastolic) ? parseInt(form.bpDiastolic) : null,
          pulseRate: n(form.pulseRate) ? parseInt(form.pulseRate) : null,
          temperature: n(form.temperature),
          weightKg: n(form.weightKg),
          heightCm: n(form.heightCm),
          oxygenSaturation: n(form.oxygenSaturation) ? parseInt(form.oxygenSaturation) : null,
          respiratoryRate: n(form.respiratoryRate) ? parseInt(form.respiratoryRate) : null,
          bloodGlucose: n(form.bloodGlucose),
          painScale: n(form.painScale) ? parseInt(form.painScale) : null,
          notes: form.notes || null,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save vitals");
      }
    });
  }

  const field = (label: string, key: keyof typeof form, unit: string, type = "number") => (
    <div>
      <label className="text-xs font-semibold text-on-surface-variant">{label}</label>
      <div className="relative mt-1">
        <input type={type} value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="—"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-outline">{unit}</span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* BP */}
        <div>
          <label className="text-xs font-semibold text-on-surface-variant">Blood Pressure</label>
          <div className="flex items-center gap-1 mt-1">
            <input type="number" value={form.bpSystolic}
              onChange={e => setForm(f => ({ ...f, bpSystolic: e.target.value }))}
              placeholder="SYS" className="w-full px-2 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary text-center" />
            <span className="text-outline text-sm">/</span>
            <input type="number" value={form.bpDiastolic}
              onChange={e => setForm(f => ({ ...f, bpDiastolic: e.target.value }))}
              placeholder="DIA" className="w-full px-2 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary text-center" />
          </div>
          <p className="text-xs text-outline mt-0.5 text-center">mmHg</p>
        </div>

        {field("Pulse Rate", "pulseRate", "bpm")}
        {field("Temperature", "temperature", "°C")}
        {field("SpO₂", "oxygenSaturation", "%")}
        {field("Weight", "weightKg", "kg")}
        {field("Height", "heightCm", "cm")}

        {/* BMI (calculated) */}
        <div>
          <label className="text-xs font-semibold text-on-surface-variant">BMI</label>
          <div className="mt-1 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low">
            <p className="text-sm font-mono text-on-surface">{bmi ?? "—"}</p>
          </div>
        </div>

        {field("Resp. Rate", "respiratoryRate", "/min")}
        {field("Blood Glucose", "bloodGlucose", "mmol/L")}

        {/* Pain scale */}
        <div>
          <label className="text-xs font-semibold text-on-surface-variant">Pain Scale (0–10)</label>
          <select value={form.painScale} onChange={e => setForm(f => ({ ...f, painScale: e.target.value }))}
            className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">—</option>
            {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i} {i === 0 ? "(none)" : i >= 8 ? "(severe)" : i >= 4 ? "(moderate)" : "(mild)"}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-on-surface-variant">Triage Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2} placeholder="Additional observations…"
          className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
      </div>

      {error && <p className="text-xs text-error bg-error-container/30 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
      {saved && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Vitals saved successfully.</p>}

      <button type="submit" disabled={isPending}
        className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-50">
        {isPending ? "Saving…" : "Save Vitals"}
      </button>
    </form>
  );
}
