"use client";

import { usePathname } from "next/navigation";

const pageLabels: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/patients":     "Patients",
  "/appointments": "Appointments",
  "/queue":        "Live Queue",
  "/reminders":    "Reminders",
  "/facility":     "Facility",
  "/inventory":    "Inventory",
  "/checklists":   "Checklists",
  "/analytics":    "Analytics",
};

interface Props {
  onMenuClick: () => void;
  userName: string;
}

export default function MobileHeader({ onMenuClick, userName }: Props) {
  const pathname = usePathname();
  const title =
    Object.entries(pageLabels).find(([path]) => pathname.startsWith(path))?.[1] ?? "BetterHealth";

  const initials = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header
      className="lg:hidden sticky top-0 z-30 flex items-center h-[60px] px-4 shrink-0"
      style={{ background: "var(--color-navy)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
    >
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-lg transition-colors"
        style={{ color: "rgba(255,255,255,0.6)" }}
        aria-label="Open navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="flex items-center gap-2.5 ml-3 flex-1 min-w-0">
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{ background: "#1d4ed8" }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z" />
          </svg>
        </div>
        <span className="text-white font-semibold text-[13px] truncate">{title}</span>
      </div>

      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
        style={{ background: "rgba(29,78,216,0.35)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.2)" }}
      >
        {initials}
      </div>
    </header>
  );
}
