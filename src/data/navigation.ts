import { Activity, ChartNoAxesCombined, Flag, Medal, Network, Search, Trophy, Users } from "lucide-react";

export const navigation = [
  { href: "/games", label: "Олимпийские игры", icon: Trophy },
  { href: "/athletes", label: "Спортсмены", icon: Users },
  { href: "/countries", label: "Страны", icon: Flag },
  { href: "/sports", label: "Виды спорта", icon: Activity },
  { href: "/analytics", label: "Аналитика", icon: ChartNoAxesCombined },
  { href: "/knowledge-graph", label: "Граф знаний", icon: Network },
] as const;

export const exploreSections = [
  { href: "/games", title: "Олимпийские игры", description: "Издания, города, сезоны и хронология.", icon: Trophy },
  { href: "/athletes", title: "Атлеты", description: "Профили, участия и связи с дисциплинами.", icon: Users },
  { href: "/countries", title: "Страны", description: "Команды, география и представительство.", icon: Flag },
  { href: "/sports", title: "Виды спорта", description: "Таксономия спорта, дисциплин и событий.", icon: Medal },
  { href: "/analytics", title: "Аналитика", description: "Историческая статистика, покрытие данных и сравнения.", icon: ChartNoAxesCombined },
  { href: "/knowledge-graph", title: "Граф знаний", description: "Визуальное исследование сущностей и отношений.", icon: Network },
  { href: "/explore", title: "Обзор базы", description: "Единая точка входа в каталог знаний.", icon: Search },
] as const;
