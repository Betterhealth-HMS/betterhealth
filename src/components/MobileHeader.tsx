"use client";

import { usePathname } from "next/navigation";

const pageLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/patients": "Patients",
  "/appointments": "Appointments",
  "/queue": "Live Queue",
  "/reminders": "Reminders",
  "/facility": "Facility",
  "/inventory": "Inventory",
};

interface Props {
  onMenuClick: () => void;
  userName: string;
}

export default function MobileHeader({ onMenuClick, userName }: Props) {
  const pathname = usePathname();
  const title =
    Object.entries(pageLabels).find(([path]) => pathname.startsWith(path))?.[1] ??
    "BetterHealth";

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center h-14 px-4 bg-navy border-b border-white/10 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Open navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="flex items-center gap-2.5 ml-3 flex-1 min-w-0">
        <div className="w-6 h-6 rounded bg-primary/30 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z" />
          </svg>
        </div>
        <span className="text-white font-semibold text-sm truncate">{title}</span>
      </div>

      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold text-white shrink-0">
        {initials}
      </div>
    </header>
  );
}
