"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function AthleteComparisonChart({ athletes }: { athletes: Array<{ name: string; gold: number | null; silver: number | null; bronze: number | null }> }) {
  return <div className="h-80 w-full" aria-label="Сравнение подтверждённых медалей"><ResponsiveContainer width="100%" height="100%"><BarChart data={athletes} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}><CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} /><XAxis dataKey="name" stroke="#78889f" tick={{ fill: "#b4bfd0", fontSize: 12 }} /><YAxis allowDecimals={false} stroke="#78889f" /><Tooltip contentStyle={{ background: "#101a2d", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} /><Legend /><Bar dataKey="gold" name="Золото" fill="#d6ad60" radius={[5,5,0,0]} /><Bar dataKey="silver" name="Серебро" fill="#b7c1cf" radius={[5,5,0,0]} /><Bar dataKey="bronze" name="Бронза" fill="#b97a55" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div>;
}
