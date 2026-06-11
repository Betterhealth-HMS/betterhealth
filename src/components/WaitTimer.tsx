"use client";

import { useEffect, useState } from "react";

export function WaitTimer({ registeredAt, className = "" }: { registeredAt: string; className?: string }) {
  const calc = () => Math.floor((Date.now() - new Date(registeredAt).getTime()) / 60000);
  const [minutes, setMinutes] = useState(calc);

  useEffect(() => {
    setMinutes(calc());
    const id = setInterval(() => setMinutes(calc()), 60000);
    return () => clearInterval(id);
  }, [registeredAt]);

  const cls = minutes > 60
    ? "text-red-700 font-semibold"
    : minutes > 30
    ? "text-amber-700 font-semibold"
    : "text-on-surface-variant";

  const label = minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return <span className={`font-mono text-xs ${cls} ${className}`}>{label}</span>;
}
