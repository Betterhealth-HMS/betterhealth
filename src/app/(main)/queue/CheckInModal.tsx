"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkInVisit } from "@/app/actions/visits";

type PatientResult = { id: string; patient_number: string; full_name: string; date_of_birth: string };

const visitTypeOptions = [
  { value: "walk_in", label: "Walk-in" },
  { value: "appointment", label: "Appointment" },
  { value: "pre_employment", label: "Pre-Employment Medical" },
  { value: "iod", label: "Injury on Duty (IOD)" },
  { value: "periodic", label: "Periodic Medical" },
  { value: "fitness_for_duty", label: "Fitness for Duty" },
];

interface Props {
  onClose: () => void;
}

export default function CheckInModal({ onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"existing" | "new">("existing");

  // Existing patient search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New patient fields
  const [newFullName, setNewFullName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newIdNumber, setNewIdNumber] = useState("");
  const [newEmployer, setNewEmployer] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Visit fields (shared)
  const [visitType, setVisitType] = useState("walk_in");
  const [complaint, setComplaint] = useState("");
  const [priority, setPriority] = useState("normal");

  useEffect(() => {
    if (tab !== "existing" || query.trim().length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("patients")
        .select("id, patient_number, full_name, date_of_birth")
        .ilike("full_name", `%${query.trim()}%`)
        .limit(6);
      setResults(data ?? []);
    }, 300);
  }, [query, tab]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        await checkInVisit({
          existingPatientId: tab === "existing" ? selectedPatient?.id : undefined,
          fullName: tab === "new" ? newFullName : undefined,
          dateOfBirth: tab === "new" ? newDob : undefined,
          gender: tab === "new" ? newGender : undefined,
          idNumber: tab === "new" ? newIdNumber : undefined,
          employer: tab === "new" ? newEmployer : undefined,
          contactPhone: tab === "new" ? newPhone : undefined,
          visitType: visitType as any,
          chiefComplaint: complaint,
          priority: priority as any,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    });
  }

  const canSubmit = (tab === "existing" ? !!selectedPatient : !!newFullName && !!newDob) && !!complaint;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-outline-variant overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-base font-semibold text-on-surface">Patient Check-In</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Patient tab switcher */}
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Patient</p>
            <div className="flex rounded-lg border border-outline-variant overflow-hidden">
              <button type="button" onClick={() => setTab("existing")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "existing" ? "bg-primary text-on-primary" : "bg-white text-on-surface-variant hover:bg-surface-container-low"}`}>
                Existing Patient
              </button>
              <button type="button" onClick={() => setTab("new")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "new" ? "bg-primary text-on-primary" : "bg-white text-on-surface-variant hover:bg-surface-container-low"}`}>
                New Patient
              </button>
            </div>
          </div>

          {/* Existing patient search */}
          {tab === "existing" && (
            <div className="space-y-2">
              {selectedPatient ? (
                <div className="flex items-center justify-between px-4 py-3 rounded-lg border-2 border-primary bg-surface-container-low">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{selectedPatient.full_name}</p>
                    <p className="text-xs text-on-surface-variant font-mono">{selectedPatient.patient_number} · DOB: {selectedPatient.date_of_birth}</p>
                  </div>
                  <button type="button" onClick={() => { setSelectedPatient(null); setQuery(""); }}
                    className="text-xs text-primary font-medium hover:underline">
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search by patient name…"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-outline-variant bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                  {results.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white rounded-lg border border-outline-variant shadow-lg z-10 overflow-hidden">
                      {results.map(p => (
                        <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setResults([]); setQuery(p.full_name); }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors">
                          <span className="text-sm font-medium text-on-surface">{p.full_name}</span>
                          <span className="text-xs text-on-surface-variant font-mono">{p.patient_number} · {p.date_of_birth}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* New patient form */}
          {tab === "new" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-on-surface-variant">Full Name *</label>
                  <input value={newFullName} onChange={e => setNewFullName(e.target.value)} required
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">Date of Birth *</label>
                  <input type="date" value={newDob} onChange={e => setNewDob(e.target.value)} required
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">Gender</label>
                  <select value={newGender} onChange={e => setNewGender(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">ID Number</label>
                  <input value={newIdNumber} onChange={e => setNewIdNumber(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant">Contact Phone</label>
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-on-surface-variant">Employer</label>
                  <input value={newEmployer} onChange={e => setNewEmployer(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </div>
          )}

          {/* Visit details */}
          <div className="border-t border-outline-variant pt-4 space-y-3">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Visit Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant">Visit Type *</label>
                <select value={visitType} onChange={e => setVisitType(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                  {visitTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant">Priority *</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-on-surface-variant">Chief Complaint *</label>
                <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={2} required
                  placeholder="Describe the patient's main concern…"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-error bg-error-container/30 border border-error/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-outline-variant text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit || isPending}
              className="flex-1 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isPending ? "Registering…" : "Check In Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
