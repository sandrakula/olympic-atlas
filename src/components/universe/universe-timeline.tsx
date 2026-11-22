import { ChevronLeft, ChevronRight, Flag, Route } from "lucide-react";
import { editionTitle, eras, type EditionSummary } from "@/lib/graph/universe";
import styles from "./universe.module.css";

const milestones: Record<string, string> = {
  "athens-1896": "Афины 1896", "chamonix-1924": "Шамони 1924", "berlin-1916-cancelled": "Отмены 1916–1944",
  "st-moritz-1948": "Возобновление в 1948", "tokyo-2020": "Токио 2020 / 2021", "paris-2024": "Париж 2024", "milano-cortina-2026": "Милан–Кортина 2026",
};

export function TimelineControls({ games, index, onIndex, onOpen }: { games: EditionSummary[]; index: number; onIndex: (index: number) => void; onOpen: () => void }) {
  const edition = games[index];
  const landmarks = games.flatMap((game, position) => milestones[game.slug] ? [{ position, label: milestones[game.slug] }] : []);
  return <section className={styles.timeline} aria-label="Путь Олимпийских игр">
    <div className={styles.timelineHeading}><Route size={17} /><h2>Путь Олимпийских игр</h2><span>{games.length} изданий в срезе</span></div>
    {edition && <>
      <div className={styles.scrubber}>
        <button type="button" aria-label="Предыдущее издание" disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={18} /></button>
        <div><output htmlFor="olympic-timeline">{editionTitle(edition)}</output>
          <input type="range" id="olympic-timeline" min={0} max={games.length - 1} value={index} aria-label="Позиция в хронологии"
            aria-valuetext={editionTitle(edition)} onChange={(event) => onIndex(Number(event.target.value))} />
          <div className={styles.timelineYears}><span>{games[0].year}</span><span>{games.at(-1)?.year}</span></div>
        </div>
        <button type="button" aria-label="Следующее издание" disabled={index >= games.length - 1} onClick={() => onIndex(index + 1)}><ChevronRight size={18} /></button>
        <button type="button" className={styles.primary} onClick={onOpen}>Данные издания</button>
      </div>
      <nav className={styles.chronologyEras} aria-label="Эпохи на временном пути">
        {eras.map((era) => {
          const position = games.findIndex(({ year }) => year >= era.start && year <= era.end);
          return position < 0 ? null : <button type="button" key={era.id} aria-pressed={edition.year >= era.start && edition.year <= era.end} onClick={() => onIndex(position)}>{era.start}–{era.end}</button>;
        })}
      </nav>
      {landmarks.length > 0 && <nav className={styles.milestones} aria-label="Ориентиры хронологии">
        {landmarks.map(({ position, label }) => <button type="button" key={position} onClick={() => onIndex(position)} aria-pressed={index === position}><Flag size={12} />{label}</button>)}
      </nav>}
    </>}
    <p className={styles.muted}>Издания идут по фактическим датам. Отменённые Игры отмечены на месте в календаре. Линии показывают последовательность изданий.</p>
  </section>;
}
