"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialQ: string;
  initialGender: string;
}

export default function PatientsSearch({ initialQ, initialGender }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [gender, setGender] = useState(initialGender);

  function navigate(newQ: string, newGender: string) {
    const params = new URLSearchParams();
    if (newQ) params.set("q", newQ);
    if (newGender) params.set("gender", newGender);
    const qs = params.toString();
    startTransition(() => {
      router.push("/patients" + (qs ? "?" + qs : ""));
    });
  }

  return (
    <div className="flex gap-3 items-center flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); navigate(e.target.value, gender); }}
          placeholder="Search patients by name, ID…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-outline-variant bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
        {isPending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>
      <select
        value={gender}
        onChange={e => { setGender(e.target.value); navigate(q, e.target.value); }}
        className="px-3 py-2 text-sm rounded-lg border border-outline-variant bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">All Genders</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
      {(q || gender) && (
        <button
          onClick={() => { setQ(""); setGender(""); navigate("", ""); }}
          className="text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container px-2 py-2 rounded-lg transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
