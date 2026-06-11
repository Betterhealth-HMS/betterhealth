"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface DayData    { date: string; total: number; completed: number }
interface StageData  { stage: string; count: number }
interface TypeData   { name: string; value: number }
interface WaitData   { stage: string; avgMin: number }

interface Props {
  weeklyData:   DayData[];
  stageData:    StageData[];
  typeData:     TypeData[];
  waitData:     WaitData[];
}

const STAGE_COLORS: Record<string, string> = {
  Registered:   "#3b82f6",
  Triage:       "#f59e0b",
  Lab:          "#a855f7",
  Consultation: "#10b981",
  Pharmacy:     "#0d9488",
  Completed:    "#94a3b8",
};

const TYPE_COLORS = ["#2563eb", "#0891b2", "#0d9488", "#f59e0b", "#8b5cf6", "#ef4444"];

const fmtMin = (v: number) => `${Math.round(v)}m`;

export default function AnalyticsCharts({ weeklyData, stageData, typeData, waitData }: Props) {
  return (
    <div className="space-y-6">
      {/* Row 1: Weekly volume + Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 7-day visit chart */}
        <div className="xl:col-span-2 rounded-lg border border-outline-variant bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface mb-4">Visit Volume — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                cursor={{ fill: "#f0f7ff" }}
              />
              <Bar dataKey="total" name="Total" fill="#dbeafe" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="w-3 h-3 rounded-sm bg-primary-100 inline-block" /> Total visits
            </span>
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Completed
            </span>
          </div>
        </div>

        {/* Current stage pipeline */}
        <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface mb-4">Current Pipeline</h2>
          {stageData.every(s => s.count === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 mb-2 opacity-25">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs">No active visits</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stageData.filter(s => s.count > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="count"
                  nameKey="stage"
                  paddingAngle={2}
                >
                  {stageData.filter(s => s.count > 0).map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Visit types + Avg wait times */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Visit type breakdown */}
        <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface mb-4">Visit Types — Last 7 Days</h2>
          {typeData.every(t => t.value === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant">
              <p className="text-xs">No visit data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={typeData.filter(t => t.value > 0)}
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {typeData.filter(t => t.value > 0).map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Average wait per stage */}
        <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-on-surface mb-1">Avg Time Per Stage — Today</h2>
          <p className="text-xs text-on-surface-variant mb-4">Minutes spent at each stage before advancing</p>
          {waitData.every(w => w.avgMin === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant">
              <p className="text-xs">No completed stage data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={waitData} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} tickFormatter={fmtMin} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  formatter={(v: number) => [`${Math.round(v)} min`, "Avg wait"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  cursor={{ fill: "#f0f7ff" }}
                />
                <Bar dataKey="avgMin" name="Avg wait" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
