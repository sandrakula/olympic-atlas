import {
  Accessibility, Activity, Anchor, Bike, BowArrow, CircleDot, CircleDotDashed, Compass, Crosshair, Disc3, Dumbbell, Fence, FlagTriangleRight,
  Footprints, Goal, Hand, HandFist, Hourglass, LandPlot, Medal, Mountain, MountainSnow, MoveDiagonal, Orbit,
  PersonStanding, Rabbit, Route, Sailboat, Shell, Shield, Ship, Snowflake, Swords, Target, Tornado, Volleyball,
  Waves, WavesLadder, Wind, Zap, type LucideIcon,
} from "lucide-react";

type SportVisual = { icon: LucideIcon; group: keyof typeof sportGroups; description?: string };

export const sportGroups = {
  track: { label: "Стадион и трасса", color: "#d6ad60" },
  water: { label: "Вода и ветер", color: "#55b9f3" },
  team: { label: "Игровые виды", color: "#82d6b5" },
  skills: { label: "Точность и техника", color: "#bfb4fa" },
  combat: { label: "Единоборства и сила", color: "#f1a99b" },
  winter: { label: "Снег и лёд", color: "#b9dcfa" },
} as const;

const visuals: Record<string, SportVisual> = {
  archery: { icon: BowArrow, group: "skills", description: "Лучники набирают очки за попадания в кольца мишени." },
  "artistic-gymnastics": { icon: Accessibility, group: "skills" },
  "artistic-swimming": { icon: Shell, group: "water", description: "Программы в воде соединяют хореографию, акробатику и синхронность." },
  athletics: { icon: Footprints, group: "track" },
  badminton: { icon: Wind, group: "team", description: "Игроки перебрасывают волан через сетку в одиночных и парных матчах." },
  basketball: { icon: CircleDot, group: "team", description: "Команды набирают очки бросками в кольцо. В программе есть форматы 5 × 5 и 3 × 3." },
  boxing: { icon: HandFist, group: "combat", description: "Поединки в весовых категориях, где судьи оценивают точные удары." },
  breaking: { icon: Disc3, group: "skills", description: "Танцоры по очереди импровизируют под музыку в батлах." },
  canoe: { icon: Compass, group: "water", description: "Соревнования на байдарках и каноэ на гладкой воде и слаломных трассах." },
  cycling: { icon: Bike, group: "track", description: "Гонки на шоссе, велотреке и пересечённой местности, а также дисциплины BMX." },
  diving: { icon: MoveDiagonal, group: "water", description: "Судьи оценивают сложность прыжка, положение тела и вход в воду." },
  equestrian: { icon: Fence, group: "track", description: "Всадники соревнуются в выездке, конкуре и троеборье." },
  fencing: { icon: Swords, group: "combat", description: "Поединки на рапирах, шпагах и саблях с разными зонами поражения." },
  "field-hockey": { icon: LandPlot, group: "team", description: "Команды ведут мяч клюшками и атакуют ворота соперника." },
  "figure-skating": { icon: Snowflake, group: "winter" },
  football: { icon: Goal, group: "team", description: "Командный турнир на поле с двумя воротами." },
  "freestyle-skiing": { icon: MountainSnow, group: "winter" },
  golf: { icon: FlagTriangleRight, group: "skills", description: "Участники проходят поле, стремясь завершить лунки за меньшее число ударов." },
  handball: { icon: Hand, group: "team", description: "Игроки передают мяч руками и бросают его в ворота." },
  judo: { icon: Shield, group: "combat" },
  "modern-pentathlon": { icon: Hourglass, group: "track", description: "Многоборье, в котором итоговое место определяется выступлением в нескольких дисциплинах." },
  "rhythmic-gymnastics": { icon: Tornado, group: "skills", description: "Индивидуальные и групповые программы с предметами под музыку." },
  rowing: { icon: Ship, group: "water", description: "Экипажи или одиночки гоняются в лодках с вёслами, закреплёнными на бортах." },
  "rugby-sevens": { icon: Orbit, group: "team", description: "Матчи по семь игроков в команде, где очки приносят попытки и удары." },
  sailing: { icon: Sailboat, group: "water", description: "Гонки под парусом по дистанции, обозначенной буями." },
  shooting: { icon: Crosshair, group: "skills", description: "Стрелки соревнуются в точности по неподвижным или летящим мишеням." },
  skateboarding: { icon: Route, group: "skills", description: "Трюки на уличных препятствиях и в парке с наклонными поверхностями." },
  "sport-climbing": { icon: Mountain, group: "skills", description: "Дисциплины отличаются задачей: скоростью подъёма, сложностью маршрута или серией коротких трасс." },
  surfing: { icon: Waves, group: "water", description: "Судьи оценивают манёвры спортсмена на волне." },
  swimming: { icon: WavesLadder, group: "water" },
  "table-tennis": { icon: Target, group: "team", description: "Одиночные и парные розыгрыши на столе с сеткой." },
  taekwondo: { icon: Zap, group: "combat", description: "Поединки в весовых категориях с акцентом на удары ногами." },
  tennis: { icon: CircleDotDashed, group: "team", description: "Одиночные и парные матчи с розыгрышами через сетку." },
  trampoline: { icon: Rabbit, group: "skills", description: "Серии акробатических элементов в воздухе после отталкивания от батута." },
  triathlon: { icon: Activity, group: "track", description: "Последовательная дистанция из плавания, велогонки и бега." },
  volleyball: { icon: Volleyball, group: "team", description: "Команды разыгрывают мяч через сетку в зале или на песке." },
  "water-polo": { icon: Anchor, group: "water", description: "Командная игра в бассейне, где очки приносят броски в ворота." },
  weightlifting: { icon: Dumbbell, group: "combat", description: "Сумма лучших попыток в рывке и толчке определяет результат." },
  wrestling: { icon: PersonStanding, group: "combat", description: "Борцы набирают очки за приёмы или выигрывают, удержав соперника на лопатках." },
};

export function sportVisual(slug?: string): SportVisual {
  return (slug && visuals[slug]) || { icon: Medal, group: "skills" as const };
}
