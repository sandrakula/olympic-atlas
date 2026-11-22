export const graphTypes = {
  OlympicEdition: { label: "Игры", color: "#55b9f3", mark: "ИГ" },
  Athlete: { label: "Спортсмен", color: "#7cdec4", mark: "АТ" },
  Country: { label: "Страна", color: "#b5a0fa", mark: "СТ" },
  NationalOlympicCommittee: { label: "Делегация", color: "#d3a3e8", mark: "НОК" },
  Sport: { label: "Вид спорта", color: "#8cbcf9", mark: "ВС" },
  Discipline: { label: "Дисциплина", color: "#a5bff5", mark: "ДС" },
  Event: { label: "Соревнование", color: "#e5a683", mark: "СР" },
  Participation: { label: "Участие", color: "#91c8ac", mark: "УЧ" },
  Team: { label: "Команда", color: "#c0d88c", mark: "КМ" },
  MedalResult: { label: "Медаль", color: "#d6ad60", mark: "МД" },
  KnowledgeSource: { label: "Источник", color: "#a1b1c8", mark: "ИС" },
} as const;

export type GraphType = keyof typeof graphTypes;
export type GraphId = `${GraphType}:${number}`;
export const graphTypesList = Object.keys(graphTypes) as GraphType[];
export const limits = { page: 12, search: 16, canvas: 72, canvasEdges: 160, depth: 6, visited: 160, fanout: 64, pages: 100 } as const;

export function parseGraphId(input: string | null | undefined): { type: GraphType; id: number } | null {
  const match = input?.match(/^([A-Za-z]+):([1-9][0-9]{0,9})$/);
  if (!match || !Object.hasOwn(graphTypes, match[1])) return null;
  const id = Number(match[2]);
  return id <= 2_147_483_647 ? { type: match[1] as GraphType, id } : null;
}

export function graphLink(type: GraphType, id: number) {
  return `/knowledge-graph?node=${type}:${id}`;
}

export type GraphNode = { id: GraphId; type: GraphType; label: string; detail: string | null; href: string | null };
export type GraphEdge = {
  id: string;
  source: GraphId;
  target: GraphId;
  label: string;
  fact: string;
  kind: "stored" | "projection" | "citation";
};
export type GraphSlice = { nodes: GraphNode[]; edges: GraphEdge[] };
export type Neighborhood = GraphSlice & { root: GraphId; page: number; more: boolean };
export type GraphEvidence = {
  edge: GraphEdge;
  sources: { title: string; url: string; publisher: string; reliability: string; field: string; note: string | null }[];
};
export type GraphPath = GraphSlice & { status: "found" | "missing" | "limited"; route: GraphId[]; depth: number };
