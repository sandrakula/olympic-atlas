"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCount, seasons, statuses } from "@/lib/analytics";

const blue = "#55b9f3";
const gold = "#d6ad60";
const axis = { fill: "#aebdd1", fontSize: 11 };
const grid = "#ffffff12";
const tooltip = {
  backgroundColor: "#080e1c", border: "1px solid #364864", borderRadius: 12, color: "#fff",
};
const cursor = { fill: "#ffffff08", stroke: "#55b9f34a" };
const value = (number: unknown) => typeof number === "number" ? formatCount(number) : "";
type Point = { name: string; year: number; season: keyof typeof seasons; slug: string; status: keyof typeof statuses };
type Series = { key: string; label: string; color: string };
type BarRow = { name: string; label?: string; axisLabel?: string; href?: string } & Record<string, string | number | null | undefined>;
const legend = (label: string) => <span className="text-xs text-[#b4bfd0]">{label}</span>;

export function TimelineChart({ editions }: { editions: Point[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const colors = { HELD: blue, CANCELLED: "#e48b88", INTERCALATED: gold };
  const marks = editions.map((row) => ({ ...row, track: row.season === "SUMMER" ? 2 : 1 }));
  if (!marks.length) return <ChartEmpty />;
  return <div className="h-48 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 15, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis type="number" dataKey="year" domain={[1896, 2026]} ticks={[1896, 1924, 1950, 1976, 2000, 2026]} tick={axis} tickLine={false} />
        <YAxis type="number" dataKey="track" domain={[0.5, 2.5]} ticks={[1, 2]} width={54} tick={axis} tickLine={false} tickFormatter={(n) => n === 2 ? seasons.SUMMER : seasons.WINTER} />
        <Tooltip cursor={cursor} content={({ active, payload }) => {
          const point = payload?.[0]?.payload as Point | undefined;
          return active && point ? <div className="rounded-xl border border-white/15 bg-[#080e1c] p-3 text-xs shadow-lg">
            <b className="text-white">{point.name}</b>
            <span className="mt-1 block text-[#b4bfd0]">{seasons[point.season]} · {statuses[point.status]}</span>
          </div> : null;
        }} />
        <Legend formatter={legend} iconType="circle" />
        {(Object.keys(statuses) as (keyof typeof statuses)[]).map((status) =>
          <Scatter key={status} name={statuses[status]} data={marks.filter((row) => row.status === status)}
            fill={colors[status]} shape={status === "CANCELLED" ? "cross" : status === "INTERCALATED" ? "diamond" : "circle"}
            isAnimationActive={!reduced} animationDuration={450} className="cursor-pointer"
            onClick={(mark) => router.push("/games/" + mark.payload.slug)} />,
        )}
      </ScatterChart>
    </ResponsiveContainer>
  </div>;
}

export function HistoryChart({ editions, series, pointsOnly }: {
  editions: (Point & Record<string, number | string | null>)[];
  series: Series[]; pointsOnly?: boolean;
}) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [preferred, setPreferred] = useState<keyof typeof seasons>("SUMMER");
  const available = (Object.keys(seasons) as (keyof typeof seasons)[]).filter((season) =>
    editions.some((edition) => edition.season === season && series.some(({ key }) => edition[key] !== null)),
  );
  const selected = available.includes(preferred) ? preferred : available[0];
  if (!selected) return <ChartEmpty />;
  const rows = editions.filter((edition) => edition.season === selected && edition.status === "HELD");
  return <>
    {available.length > 1 && <div className="mb-3 flex gap-2" role="group" aria-label="Сезон на диаграмме">
      {available.map((season) => <button key={season} type="button" aria-pressed={selected === season}
        onClick={() => setPreferred(season)}
        className="min-h-10 rounded-full border border-white/10 px-3 text-xs text-[#b4bfd0] aria-pressed:border-[#55b9f3]/50 aria-pressed:bg-[#55b9f3]/10 aria-pressed:text-white">{seasons[season]}</button>)}
    </div>}
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="year" type="number" domain={rows.length > 1 ? ["dataMin", "dataMax"] : [rows[0].year - 2, rows[0].year + 2]} allowDecimals={false} tick={axis} tickLine={false} minTickGap={22} />
          <YAxis width={48} allowDecimals={false} tick={axis} tickLine={false} />
          <Tooltip cursor={cursor} content={({ active, payload }) => {
            const point = payload?.[0]?.payload as (Point & { statisticsNote?: string }) | undefined;
            return active && point && payload?.length ? <div className="max-w-52 rounded-xl border border-white/15 bg-[#080e1c] p-3 text-xs shadow-lg sm:max-w-xs">
              <b className="text-white">{point.name}</b>
              <ul className="mt-1 space-y-1 text-[#c3cedf]">
                {payload.map((item) => <li key={String(item.dataKey)}>{item.name} · {value(item.value)}</li>)}
              </ul>
              {point.statisticsNote && <p className="mt-2 text-[#e7c77f]">{point.statisticsNote}</p>}
            </div> : null;
          }} />
          {series.length > 1 && <Legend formatter={legend} />}
          {series.map(({ key, label, color }) => <Line key={key} dataKey={key} name={label} stroke={color}
            connectNulls={false} strokeWidth={pointsOnly ? 0 : 2} dot={{ r: rows.length > 20 ? 2 : 3, fill: color }}
            isAnimationActive={!reduced} animationDuration={500}
            activeDot={{ r: 6, cursor: "pointer", onClick: (_event, point) => {
              const datum = point as { payload?: Point };
              if (datum.payload) router.push("/games/" + datum.payload.slug);
            } }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </>;
}

export function AnalyticsBars({ rows, series, stacked = false, horizontal = false }: {
  rows: BarRow[]; series: Series[]; stacked?: boolean; horizontal?: boolean;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  if (!rows.some((row) => series.some(({ key }) => typeof row[key] === "number"))) return <ChartEmpty />;
  const accessibleNames = new Map(rows.map((row) => [row.name, row.label ?? row.name]));
  const axisNames = new Map(rows.map((row) => [row.name, row.axisLabel ?? row.name]));
  return <div className="w-full" style={{ height: horizontal ? Math.max(170, rows.length * 30 + 55) : 250 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={grid} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? <>
          <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} />
          <YAxis type="category" dataKey="name" width={95} tick={axis} tickLine={false}
            tickFormatter={(name) => axisNames.get(String(name)) ?? String(name)} />
        </> : <>
          <XAxis dataKey="name" tick={axis} tickLine={false} minTickGap={12} />
          <YAxis allowDecimals={false} width={38} tick={axis} tickLine={false} />
        </>}
        <Tooltip cursor={cursor} contentStyle={tooltip} itemStyle={{ color: "#e6edf8" }}
          labelFormatter={(label) => accessibleNames.get(String(label)) ?? label} formatter={value} />
        {series.length > 1 && <Legend formatter={legend} />}
        {series.map(({ key, label, color }) => <Bar key={key} dataKey={key} name={label} fill={color}
          stackId={stacked ? "results" : undefined} radius={stacked ? 0 : 3} maxBarSize={48}
          isAnimationActive={!reduced} animationDuration={450}
          onClick={(entry) => { if (entry.payload.href) router.push(entry.payload.href); }}>
          {rows.map((row) => <Cell key={row.name} cursor={row.href ? "pointer" : "default"} />)}
        </Bar>)}
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function PhotoDonut({ photos, total }: { photos: number; total: number }) {
  const reduced = useReducedMotion();
  if (!total) return <ChartEmpty />;
  const rows = [{ name: "С фото", count: photos }, { name: "Без фото", count: total - photos }];
  return <div className="relative h-48 w-full">
    <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
      <strong className="text-3xl text-white">{Math.round(100 * photos / total)}%</strong>
      <span className="text-xs text-[#aebdd1]">профилей с фото</span>
    </div>
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="name" innerRadius={67} outerRadius={83} stroke="none"
          isAnimationActive={!reduced} animationDuration={550}>
          <Cell fill={gold} /><Cell fill="#32425d" />
        </Pie>
        <Tooltip contentStyle={tooltip} itemStyle={{ color: "#e6edf8" }} formatter={value} />
      </PieChart>
    </ResponsiveContainer>
  </div>;
}

function ChartEmpty() {
  return <p className="grid min-h-32 place-items-center rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-[#aebdd1]">Нет данных для выбранных условий</p>;
}
