"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const roadmap = [
  { stage: "Основа", coverage: 9 }, { stage: "Данные", coverage: 24 },
  { stage: "Запросы", coverage: 38 }, { stage: "Граф", coverage: 52 },
];

export function RoadmapChart() {
  return <div className="h-56 w-full" aria-label="Демонстрационная диаграмма плана развития">
    <ResponsiveContainer width="100%" height="100%"><AreaChart data={roadmap} margin={{ top: 12, right: 4, left: -28, bottom: 0 }}>
      <defs><linearGradient id="coverage" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#55b9f3" stopOpacity={0.28} /><stop offset="100%" stopColor="#55b9f3" stopOpacity={0} /></linearGradient></defs>
      <CartesianGrid stroke="#24334a" vertical={false} />
      <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: "#98a6bb", fontSize: 12 }} />
      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#78889f", fontSize: 11 }} />
      <Tooltip contentStyle={{ background: "#101a2d", border: "1px solid #2a3950", borderRadius: 12 }} labelStyle={{ color: "#f5f7fc" }} itemStyle={{ color: "#8bd2fa" }} formatter={(value) => [`${value} типов связей`, "План"]} />
      <Area type="monotone" dataKey="coverage" stroke="#55b9f3" strokeWidth={2} fill="url(#coverage)" />
    </AreaChart></ResponsiveContainer>
  </div>;
}
