"use client";

import { useState, useTransition, useRef } from "react";
import { createAppointment } from "@/app/actions/appointments";

const APPT_TYPES = [
  { value: "general_consultation", label: "General Consultation" },
  { value: "follow_up", label: "Follow Up" },
  { value: "pre_employment", label: "Pre-Employment Medical" },
  { value: "periodic", label: "Periodic Medical" },
  { value: "fitness_for_duty", label: "Fitness for Duty" },
  { value: "iod", label: "Injury on Duty (IOD)" },
  { value: "vaccination", label: "Vaccination" },
  { value: "specialist_referral", label: "Specialist Referral" },
];

interface PatientOption { id: string; full_name: string; patient_number: string }
interface DoctorOption  { id: string; full_name: string | null }

interface Props {
  doctors:  DoctorOption[];
  patients: PatientOption[];
}

export default function NewAppointmentModal({ doctors, patients }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const suggestions = patientQuery.length >= 1
    ? patients.filter(p =>
        p.full_name.toLowerCase().includes(patientQuery.toLowerCase()) ||
        p.patient_number.toLowerCase().includes(patientQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  function close() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    setSuccess(false);
    setSelectedPatient(null);
    setPatientQuery("");
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) { setError("Please select a patient"); return; }
    setError(null);
    const formData = new FormData(formRef.current!);
    formData.set("patient_id", selectedPatient.id);
    startTransition(async () => {
      try {
        await createAppointment(formData);
        setSuccess(true);
        setTimeout(close, 1000);
      } catch (err: any) {
        setError(err.message ?? "Failed to book appointment");
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
        New Appointment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Book Appointment</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">Complete all required fields</p>
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
                <p className="text-sm font-semibold text-on-surface">Appointment booked successfully</p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {error && (
                  <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
                )}

                {/* Patient search */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Patient *</label>
                  {selectedPatient ? (
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-primary bg-primary/5">
                      <div>
                        <p className="text-sm font-medium text-on-surface">{selectedPatient.full_name}</p>
                        <p className="text-xs font-mono text-on-surface-variant">{selectedPatient.patient_number}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={patientQuery}
                        onChange={e => { setPatientQuery(e.target.value); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                        placeholder="Search by name or patient ID…"
                        autoComplete="off"
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      {showDropdown && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white rounded-lg border border-outline-variant shadow-lg z-20 max-h-48 overflow-y-auto">
                          {suggestions.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-4 py-2.5 hover:bg-surface-container transition-colors border-b border-outline-variant/50 last:border-0"
                              onMouseDown={() => { setSelectedPatient(p); setPatientQuery(""); setShowDropdown(false); }}
                            >
                              <p className="text-sm font-medium text-on-surface">{p.full_name}</p>
                              <p className="text-xs font-mono text-on-surface-variant">{p.patient_number}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Appointment type */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Appointment Type *</label>
                  <select name="appointment_type" required className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                    {APPT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Date *</label>
                    <input
                      type="date"
                      name="scheduled_date"
                      required
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Time *</label>
                    <input
                      type="time"
                      name="scheduled_time"
                      required
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Doctor */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Assigned Doctor</label>
                  <select name="assigned_doctor" className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">— Unassigned —</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name ?? "Doctor"}</option>)}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Special instructions or reason for visit…"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant">
                  <button type="button" onClick={close} disabled={isPending} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !selectedPatient}
                    className="px-5 py-2 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "Booking…" : "Book Appointment"}
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
