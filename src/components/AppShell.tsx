"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import MobileHeader from "./MobileHeader";
import type { Role } from "@/lib/supabase/types";

interface Props {
  userName: string;
  userRole: Role;
  children: React.ReactNode;
}

export default function AppShell({ userName, userRole, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={userName}
        userRole={userRole}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader
          onMenuClick={() => setSidebarOpen(true)}
          userName={userName}
        />
        {children}
      </div>
    </div>
  );
}
