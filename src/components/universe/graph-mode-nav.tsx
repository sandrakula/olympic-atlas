import Link from "next/link";
import { Network, Orbit } from "lucide-react";
import styles from "./universe.module.css";

export function GraphModeNav({ exact = false }: { exact?: boolean }) {
  return <nav className={styles.modeNav} aria-label="Режим графа знаний">
    <Link href="/knowledge-graph" aria-current={exact ? undefined : "page"}><Orbit size={17} aria-hidden /> Олимпийская вселенная</Link>
    <Link href="/knowledge-graph?mode=explore" aria-current={exact ? "page" : undefined}><Network size={17} aria-hidden /> Исследование связей</Link>
  </nav>;
}
