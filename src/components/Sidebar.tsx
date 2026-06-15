"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/supabase/types";

const allNavItems = [
  {
    href: "/dashboard", label: "Dashboard", section: "clinical",
    roles: ["receptionist","nurse","doctor","lab_technician","pharmacist","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    href: "/patients", label: "Patients", section: "clinical",
    roles: ["receptionist","nurse","doctor","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    href: "/appointments", label: "Appointments", section: "clinical",
    roles: ["receptionist","doctor","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    href: "/queue", label: "Live Queue", section: "clinical",
    roles: ["receptionist","nurse","doctor","lab_technician","pharmacist","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  },
  {
    href: "/reminders", label: "Reminders", section: "operations",
    roles: ["receptionist","nurse","doctor","pharmacist","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  },
  {
    href: "/facility", label: "Facility", section: "operations",
    roles: ["nurse","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    href: "/inventory", label: "Inventory", section: "operations",
    roles: ["pharmacist","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  {
    href: "/checklists", label: "Checklists", section: "operations",
    roles: ["nurse","doctor","lab_technician","pharmacist","manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  },
  {
    href: "/analytics", label: "Analytics", section: "management",
    roles: ["manager","admin"],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-[18px] h-[18px]"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><path d="M3 20h18"/></svg>,
  },
];

const NAV_SECTIONS = [
  { key: "clinical",    label: "Clinical" },
  { key: "operations",  label: "Operations" },
  { key: "management",  label: "Management" },
];

const roleLabels: Record<Role, string> = {
  receptionist:   "Receptionist",
  nurse:          "Nurse",
  doctor:         "Doctor",
  lab_technician: "Lab Technician",
  pharmacist:     "Pharmacist",
  manager:        "Manager",
  admin:          "Administrator",
};

interface Props {
  userName?: string;
  userRole?: Role;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ userName = "Staff", userRole = "receptionist", isOpen = false, onClose }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const filteredItems = allNavItems.filter(i => i.roles.includes(userRole));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-60 flex flex-col shrink-0",
          "transition-transform duration-200 ease-in-out",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{ background: "var(--color-navy)" }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 h-[60px] shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "#1d4ed8" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
                <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white leading-tight tracking-tight">BetterHealth</p>
              <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>Occupational Health</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_SECTIONS.map(section => {
            const items = filteredItems.filter(i => i.section === section.key);
            if (!items.length) return null;
            return (
              <div key={section.key} className="mb-1">
                <p
                  className="px-5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  {section.label}
                </p>
                {items.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="relative flex items-center gap-3 px-5 py-[9px] text-[13px] transition-colors duration-100"
                      style={{
                        color:      active ? "#ffffff" : "rgba(255,255,255,0.52)",
                        background: active ? "rgba(255,255,255,0.07)" : "transparent",
                        fontWeight: active ? 500 : 400,
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; (e.currentTarget as HTMLElement).style.background = active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? "#ffffff" : "rgba(255,255,255,0.52)"; (e.currentTarget as HTMLElement).style.background = active ? "rgba(255,255,255,0.07)" : "transparent"; }}
                    >
                      {/* Left accent */}
                      {active && (
                        <span className="absolute inset-y-[6px] left-0 w-[3px] rounded-r-full" style={{ background: "#60a5fa" }} />
                      )}
                      <span style={{ color: active ? "#93c5fd" : "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Status strip */}
          <div
            className="flex items-center justify-between px-5 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>System Live</span>
            </div>
            {time && (
              <span className="text-[11px] font-mono tabular-nums" style={{ color: "rgba(255,255,255,0.25)" }}>
                {time}
              </span>
            )}
          </div>

          {/* User card */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
              style={{ background: "rgba(29,78,216,0.35)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.2)" }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white truncate leading-tight">{userName}</p>
              <p className="text-[11px] leading-tight truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                {roleLabels[userRole]}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1.5 rounded-md transition-colors shrink-0"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
