export function AnimatedMetric({ value, suffix = "" }: { value: number; suffix?: string }) {
  return <span className="tabular-nums">{value.toLocaleString("ru-RU")}{suffix}</span>;
}
