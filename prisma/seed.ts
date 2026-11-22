import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { MedalType, OlympicEditionStatus, PrismaClient, ResultType, SourceReliability } from "../src/generated/prisma/client";
import { olympicEditions, olympicHostCountries } from "./data/olympic-editions";
import { applyReleaseAudit, parisPhoto } from "./data/release-audit";
import { sqliteUrl } from "../src/lib/sqlite-url";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: sqliteUrl() }) });
const accessedAt = new Date("2026-11-21T00:00:00.000Z");

const sourceData = {
  editions: {
    title: "The Olympic Movement, the IOC and the Olympic Games",
    url: "https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=3703315&parentDocumentId=172552&skipCopyright=true&skipWatermark=true",
  },
  cancellations: {
    title: "The modern Olympic Games caught in the upheavals of history",
    url: "https://www.olympics.com/ioc/news/the-modern-games-caught-in-the-upheavals-of-history",
  },
  intercalated1906: {
    title: "Olympic Films: From the Beginning — Athens 1906",
    url: "https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=2955475&parentDocumentId=185877&skipCopyright=true&skipWatermark=true",
  },
  milanoFacts: {
    title: "Milano Cortina 2026 in numbers",
    url: "https://www.olympics.com/ioc/news/milano-cortina-2026-in-numbers-record-engagement-efficient-delivery-world-class-performance",
  },
  tokyoDates: {
    title: "IOC, IPC, Tokyo 2020 and Tokyo Metropolitan Government announce new dates",
    url: "https://www.olympics.com/ioc/news/ioc-ipc-tokyo-2020-organising-committee-and-tokyo-metropolitan-government-announce-new-dates-for-the-olympic-and-paralympic-games-tokyo-2020",
  },
  beijingFacts: {
    title: "Beijing 2022 Facts and Figures",
    url: "https://www.olympics.com/ioc/beijing-2022-facts-and-figures",
  },
  parisDates: {
    title: "Paris 2024: The stage is set for sport and the celebration of Olympism",
    url: "https://www.olympics.com/ioc/news/paris-2024-the-stage-is-set-for-sport-and-the-celebration-of-olympism",
  },
  athens: {
    title: "Athens 1896: The revival of the Olympic Games",
    url: "https://www.olympics.com/ioc/news/athens-1896-the-revival-of-the-olympic-games",
  },
  athens100: {
    title: "6 April 1896: the 100m opens the first Olympic Games of the modern era",
    url: "https://www.olympics.com/ioc/news/6-april-1896-the-100m-opens-the-first-olympic-games-of-the-modern-era",
  },
  connolly: {
    title: "Three giant leaps into the history books",
    url: "https://www.olympics.com/ioc/news/three-giant-leaps-into-the-history-books",
  },
  bolt: {
    title: "Bolt confirms status as greatest sprinter in history",
    url: "https://www.olympics.com/ioc/news/bolt-confirms-status-as-greatest-sprinter-in-history",
  },
  phelps: {
    title: "Michael Phelps: training regimen, diet, gold medals and world records",
    url: "https://www.olympics.com/ioc/news/michael-phelps-training-regimen-workut-diet",
  },
  biles: {
    title: "Simone Biles: a timeline of key moments",
    url: "https://www.olympics.com/ioc/news/simone-biles-timeline-key-moments-gymnastics-great",
  },
  silva: {
    title: "IOC takes a stand against discrimination and celebrates the power of sport",
    url: "https://www.olympics.com/ioc/news/ioc-takes-a-stand-against-discrimination-and-celebrates-the-power-of-sport-to-fightracism",
  },
  gu: {
    title: "Eileen Gu appointed Global Ambassador for Gangwon 2024",
    url: "https://www.olympics.com/ioc/news/olympic-and-youth-olympic-champion-eileen-gu-appointed-as-the-global-ambassador-for-gangwon-2024",
  },
  chen: {
    title: "Beijing 2022 Figure Skating — Medallists by Event",
    url: "https://library.olympics.com/default/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=1854887&parentDocumentId=1568639",
  },
  parisResults: {
    title: "Paris 2024: Record-breaking Olympic Games on and off the field",
    url: "https://www.olympics.com/ioc/news/paris-2024-record-breaking-olympic-games-on-and-off-the-field",
  },
  marchand: {
    title: "Paris 2024 Official Report",
    url: "https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=3702240&parentDocumentId=3598869&skipCopyright=true&skipWatermark=true",
  },
} as const;

type SourceKey = keyof typeof sourceData;
type ResultSeed = { athlete: string; edition: string; noc: string; sport: string; event: string; gender: string; medal: MedalType; source: SourceKey; resultText?: string };

const editionImages: Record<string, { imageUrl: string; imageSourceUrl: string; imageAuthor: string; imageLicense: string; imageAlt: string }> = {
  "athens-1896": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Panathenaic%20Stadium.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Panathenaic_Stadium.jpg",
    imageAuthor: "Danbu14",
    imageLicense: "CC BY-SA 3.0",
    imageAlt: "Панатинаикос — мраморный стадион в Афинах, связанный с Играми 1896 года",
  },
  "montreal-1976": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Olympic%20Stadium%20%28Montreal%29.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Olympic_Stadium_(Montreal).jpg",
    imageAuthor: "Reuven Frizi",
    imageLicense: "CC BY-SA 3.0",
    imageAlt: "Олимпийский стадион Монреаля",
  },
  "beijing-2008": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Beijing%20national%20stadium.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Beijing_national_stadium.jpg",
    imageAuthor: "Peter23",
    imageLicense: "CC BY-SA 3.0",
    imageAlt: "Национальный стадион Пекина «Птичье гнездо» ночью",
  },
  "london-2012": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/London%202012%20Olympic%20Stadium.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:London_2012_Olympic_Stadium.jpg",
    imageAuthor: "Frank Steiner",
    imageLicense: "CC BY 2.0",
    imageAlt: "Олимпийский стадион Лондона перед Играми 2012 года",
  },
  "rio-2016": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Macaran%C3%A3%20Stadium%2C%20Rio%2C%20Brazil.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Macaran%C3%A3_Stadium,_Rio,_Brazil.jpg",
    imageAuthor: "CivArmy",
    imageLicense: "CC BY-SA 4.0",
    imageAlt: "Стадион Маракана в Рио-де-Жанейро",
  },
  "tokyo-2020": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Exterior%20of%20Japan%20National%20Stadium.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Exterior_of_Japan_National_Stadium.jpg",
    imageAuthor: "Indiana jo",
    imageLicense: "CC BY-SA 4.0",
    imageAlt: "Внешний вид нового Национального стадиона Японии в Токио",
  },
  "beijing-2022": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Beijing%20national%20stadium.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Beijing_national_stadium.jpg",
    imageAuthor: "Peter23",
    imageLicense: "CC BY-SA 3.0",
    imageAlt: "Национальный стадион Пекина, использованный для церемоний зимних Игр 2022 года",
  },
  "paris-2024": parisPhoto,
  "milano-cortina-2026": {
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/San%20Siro%20stadio.jpg?width=1600",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:San_Siro_stadio.jpg",
    imageAuthor: "Bukkia1990",
    imageLicense: "CC BY-SA 4.0",
    imageAlt: "Стадион Сан-Сиро в Милане, площадка церемонии открытия Milano Cortina 2026",
  },
};

async function main() {
  const sources = {} as Record<SourceKey, { id: number }>;
  for (const [key, source] of Object.entries(sourceData) as [SourceKey, (typeof sourceData)[SourceKey]][]) {
    sources[key] = await prisma.knowledgeSource.upsert({
      where: { url: source.url },
      update: { title: source.title, publisher: "International Olympic Committee", accessedAt, reliability: SourceReliability.OFFICIAL },
      create: { ...source, publisher: "International Olympic Committee", accessedAt, reliability: SourceReliability.OFFICIAL },
      select: { id: true },
    });
  }

  const countriesInput = [
    ...olympicHostCountries,
    { code: "JAM", name: "Ямайка", region: "Карибский регион" },
    { code: "DMA", name: "Доминика", region: "Карибский регион" },
    { code: "LCA", name: "Сент-Люсия", region: "Карибский регион" },
  ];
  const countries: Record<string, { id: number }> = {};
  for (const country of countriesInput) {
    countries[country.code] = await prisma.country.upsert({
      where: { code: country.code },
      update: country,
      create: country,
      select: { id: true },
    });
  }

  const nocsInput = [
    ["GRE", "Олимпийский комитет Греции", "GRC"], ["GBR", "Британская олимпийская ассоциация", "GBR"],
    ["BRA", "Олимпийский комитет Бразилии", "BRA"], ["JPN", "Олимпийский комитет Японии", "JPN"],
    ["CHN", "Олимпийский комитет Китая", "CHN"], ["FRA", "Олимпийский комитет Франции", "FRA"],
    ["USA", "Олимпийский и Паралимпийский комитет США", "USA"], ["JAM", "Олимпийская ассоциация Ямайки", "JAM"],
    ["DMA", "Олимпийский комитет Доминики", "DMA"], ["LCA", "Олимпийский комитет Сент-Люсии", "LCA"],
  ] as const;
  const nocs: Record<string, { id: number }> = {};
  for (const [code, name, countryCode] of nocsInput) {
    nocs[code] = await prisma.nationalOlympicCommittee.upsert({
      where: { code }, update: { name, countryId: countries[countryCode].id },
      create: { code, name, countryId: countries[countryCode].id, historicalNote: "Связь с государством относится к периоду данных текущего seed." }, select: { id: true },
    });
  }

  const editions: Record<string, { id: number }> = {};
  for (const edition of olympicEditions) {
    const status = edition.status ?? OlympicEditionStatus.HELD;
    const seasonLabel = edition.season === "SUMMER" ? "летние" : "зимние";
    const name = status === OlympicEditionStatus.CANCELLED
      ? `Отменённые ${seasonLabel} Игры — ${edition.year}`
      : status === OlympicEditionStatus.INTERCALATED
        ? `Межолимпийские игры — Афины 1906`
        : `${seasonLabel === "летние" ? "Летние" : "Зимние"} Олимпийские игры — ${edition.hostCity} ${edition.year}`;
    const description = edition.historicalNote ?? `${seasonLabel[0].toUpperCase()}${seasonLabel.slice(1)} Олимпийские игры ${edition.year} года в ${edition.hostCity}.`;
    const image = editionImages[edition.slug];
    const data = {
      name,
      year: edition.year,
      heldYear: edition.heldYear ?? edition.year,
      season: edition.season,
      status,
      startDate: edition.startDate ? new Date(`${edition.startDate}T00:00:00.000Z`) : null,
      endDate: edition.endDate ? new Date(`${edition.endDate}T00:00:00.000Z`) : null,
      hostCity: edition.hostCity,
      hostCountryId: edition.host ? countries[edition.host].id : null,
      description,
      historicalNote: edition.historicalNote ?? null,
      athleteCount: edition.athleteCount ?? null,
      delegationCount: edition.delegationCount ?? null,
      sportCount: edition.sportCount ?? null,
      eventCount: edition.eventCount ?? null,
      statisticsNote: edition.statisticsNote ?? null,
      imageUrl: image?.imageUrl ?? null,
      imageSourceUrl: image?.imageSourceUrl || null,
      imageAuthor: image?.imageAuthor ?? null,
      imageLicense: image?.imageLicense ?? null,
      imageAlt: image?.imageAlt ?? null,
    };
    const row = await prisma.olympicEdition.upsert({
      where: { slug: edition.slug },
      update: data,
      create: { slug: edition.slug, ...data },
      select: { id: true },
    });
    editions[edition.slug] = row;
    const source = status === OlympicEditionStatus.CANCELLED
      ? sources.cancellations
      : status === OlympicEditionStatus.INTERCALATED
        ? sources.intercalated1906
        : edition.slug === "milano-cortina-2026"
          ? sources.milanoFacts
          : sources.editions;
    await cite(source.id, "OlympicEdition", row.id, "core", "Название, статус, место и даты издания.");
  }

  const sportsInput = [
    ["athletics", "Лёгкая атлетика", "Беговые, прыжковые и другие стадионные и шоссейные дисциплины."],
    ["swimming", "Плавание", "Олимпийские соревнования по плаванию в бассейне."],
    ["artistic-gymnastics", "Спортивная гимнастика", "Соревнования на гимнастических снарядах и в многоборье."],
    ["judo", "Дзюдо", "Олимпийский вид единоборств с весовыми категориями."],
    ["freestyle-skiing", "Фристайл", "Зимний вид спорта, включающий лыжные акробатические дисциплины."],
    ["figure-skating", "Фигурное катание", "Зимний вид спорта на льду с одиночными и командными соревнованиями."],
  ] as const;
  const sports: Record<string, { id: number }> = {};
  const disciplines: Record<string, { id: number }> = {};
  for (const [slug, name, description] of sportsInput) {
    sports[slug] = await prisma.sport.upsert({ where: { slug }, update: { name, description }, create: { slug, name, description }, select: { id: true } });
    disciplines[slug] = await prisma.discipline.upsert({ where: { slug }, update: { name, sportId: sports[slug].id }, create: { slug, name, sportId: sports[slug].id }, select: { id: true } });
  }

  const athletesInput = [
    ["james-connolly", "Джеймс Коннолли", "USA", "Победитель тройного прыжка на Играх 1896 года и первый чемпион современных Олимпийских игр.", "connolly"],
    ["spyridon-louis", "Спиридон Луис", "GRC", "Греческий победитель марафона на Играх в Афинах 1896 года.", "athens"],
    ["thomas-burke", "Томас Бёрк", "USA", "Американский победитель бега на 100 метров на Играх 1896 года.", "athens100"],
    ["usain-bolt", "Усэйн Болт", "JAM", "Ямайский спринтер, выигравший олимпийские титулы на 100 и 200 метров в Лондоне и Рио.", "bolt"],
    ["michael-phelps", "Майкл Фелпс", "USA", "Американский пловец; в базе отражены проверенные индивидуальные медали Лондона 2012 и Рио 2016.", "phelps"],
    ["simone-biles", "Симона Байлз", "USA", "Американская гимнастка, завоевавшая в Рио четыре золота и бронзу; в базе представлены индивидуальные результаты.", "biles"],
    ["rafaela-silva", "Рафаэла Силва", "BRA", "Бразильская дзюдоистка, олимпийская чемпионка Рио 2016 в категории до 57 кг.", "silva"],
    ["eileen-gu", "Гу Айлин Эйлин", "CHN", "Представительница Китая, завоевавшая два золота и серебро во фристайле на Пекине 2022.", "gu"],
    ["nathan-chen", "Нэйтан Чен", "USA", "Американский фигурист, олимпийский чемпион Пекина 2022 в мужском одиночном катании.", "chen"],
    ["leon-marchand", "Леон Маршан", "FRA", "Французский пловец, завоевавший четыре золотые медали на Париже 2024.", "marchand"],
    ["thea-lafond", "Теа Лафонд", "DMA", "Победительница женского тройного прыжка в Париже 2024 и первая олимпийская чемпионка Доминики.", "parisResults"],
    ["julien-alfred", "Жюльен Альфред", "LCA", "Победительница женского бега на 100 метров в Париже 2024 и первая олимпийская чемпионка Сент-Люсии.", "parisResults"],
  ] as const;
  const athletes: Record<string, { id: number }> = {};
  for (const [slug, fullName, countryCode, biography, sourceKey] of athletesInput) {
    const row = await prisma.athlete.upsert({ where: { slug }, update: { fullName, countryId: countries[countryCode].id, biography, dataStatus: "VERIFIED_RESULTS" }, create: { slug, fullName, countryId: countries[countryCode].id, biography, dataStatus: "VERIFIED_RESULTS" }, select: { id: true } });
    athletes[slug] = row;
    await cite(sources[sourceKey as SourceKey].id, "Athlete", row.id, "biography", "Краткая биография основана на официальном материале IOC/Olympics.");
  }

  const results: ResultSeed[] = [
    { athlete: "james-connolly", edition: "athens-1896", noc: "USA", sport: "athletics", event: "Тройной прыжок", gender: "Мужчины", medal: MedalType.GOLD, source: "connolly", resultText: "13,71 м" },
    { athlete: "spyridon-louis", edition: "athens-1896", noc: "GRE", sport: "athletics", event: "Марафон", gender: "Мужчины", medal: MedalType.GOLD, source: "athens" },
    { athlete: "thomas-burke", edition: "athens-1896", noc: "USA", sport: "athletics", event: "100 м", gender: "Мужчины", medal: MedalType.GOLD, source: "athens100" },
    ...twoEditionResults("usain-bolt", "JAM", "athletics", "london-2012", "rio-2016", ["100 м", "200 м"], MedalType.GOLD, "bolt", "Мужчины"),
    ...phelpsResults(),
    { athlete: "simone-biles", edition: "rio-2016", noc: "USA", sport: "artistic-gymnastics", event: "Индивидуальное многоборье", gender: "Женщины", medal: MedalType.GOLD, source: "biles" },
    { athlete: "simone-biles", edition: "rio-2016", noc: "USA", sport: "artistic-gymnastics", event: "Опорный прыжок", gender: "Женщины", medal: MedalType.GOLD, source: "biles" },
    { athlete: "simone-biles", edition: "rio-2016", noc: "USA", sport: "artistic-gymnastics", event: "Вольные упражнения", gender: "Женщины", medal: MedalType.GOLD, source: "biles" },
    { athlete: "simone-biles", edition: "rio-2016", noc: "USA", sport: "artistic-gymnastics", event: "Бревно", gender: "Женщины", medal: MedalType.BRONZE, source: "biles" },
    { athlete: "rafaela-silva", edition: "rio-2016", noc: "BRA", sport: "judo", event: "До 57 кг", gender: "Женщины", medal: MedalType.GOLD, source: "silva" },
    { athlete: "eileen-gu", edition: "beijing-2022", noc: "CHN", sport: "freestyle-skiing", event: "Биг-эйр", gender: "Женщины", medal: MedalType.GOLD, source: "gu" },
    { athlete: "eileen-gu", edition: "beijing-2022", noc: "CHN", sport: "freestyle-skiing", event: "Хафпайп", gender: "Женщины", medal: MedalType.GOLD, source: "gu" },
    { athlete: "eileen-gu", edition: "beijing-2022", noc: "CHN", sport: "freestyle-skiing", event: "Слоупстайл", gender: "Женщины", medal: MedalType.SILVER, source: "gu" },
    { athlete: "nathan-chen", edition: "beijing-2022", noc: "USA", sport: "figure-skating", event: "Одиночное катание", gender: "Мужчины", medal: MedalType.GOLD, source: "chen" },
    { athlete: "thea-lafond", edition: "paris-2024", noc: "DMA", sport: "athletics", event: "Тройной прыжок", gender: "Женщины", medal: MedalType.GOLD, source: "parisResults" },
    { athlete: "julien-alfred", edition: "paris-2024", noc: "LCA", sport: "athletics", event: "100 м", gender: "Женщины", medal: MedalType.GOLD, source: "parisResults" },
  ];

  const participationKeys = new Set<string>();
  for (const result of results) {
    const eventSlug = `${result.edition}-${result.sport}-${slugify(result.event)}-${slugify(result.gender)}`;
    const event = await prisma.event.upsert({
      where: { slug: eventSlug },
      update: { name: result.event, gender: result.gender, editionId: editions[result.edition].id, disciplineId: disciplines[result.sport].id },
      create: { slug: eventSlug, name: result.event, gender: result.gender, editionId: editions[result.edition].id, disciplineId: disciplines[result.sport].id },
      select: { id: true },
    });
    const resultKey = `${eventSlug}:${result.noc}:${result.athlete}:${result.medal}`;
    const medal = await prisma.medalResult.upsert({
      where: { resultKey },
      update: { medal: result.medal, rank: medalRank(result.medal), resultType: ResultType.INDIVIDUAL, resultText: result.resultText, eventId: event.id, athleteId: athletes[result.athlete].id, teamId: null, nocId: nocs[result.noc].id },
      create: { resultKey, medal: result.medal, rank: medalRank(result.medal), resultType: ResultType.INDIVIDUAL, resultText: result.resultText, eventId: event.id, athleteId: athletes[result.athlete].id, nocId: nocs[result.noc].id },
      select: { id: true },
    });
    await cite(sources[result.source].id, "MedalResult", medal.id, "result", `Подтверждает медаль в событии «${result.event}».`);

    const participationKey = `${result.athlete}:${result.edition}:${result.noc}:${result.sport}`;
    if (!participationKeys.has(participationKey)) {
      participationKeys.add(participationKey);
      const participation = await prisma.participation.upsert({
        where: { athleteId_editionId_nocId_sportId: { athleteId: athletes[result.athlete].id, editionId: editions[result.edition].id, nocId: nocs[result.noc].id, sportId: sports[result.sport].id } },
        update: { note: "Участие подтверждено связанным официальным медальным результатом." },
        create: { athleteId: athletes[result.athlete].id, editionId: editions[result.edition].id, nocId: nocs[result.noc].id, sportId: sports[result.sport].id, note: "Участие подтверждено связанным официальным медальным результатом." },
        select: { id: true },
      });
      await cite(sources[result.source].id, "Participation", participation.id, "participation", "Участие подтверждается официальным результатом.");
    }
  }

  // Маршан включён как подтверждённый участник и четырёхкратный чемпион; детальные
  // строки событий не создаются, пока источник в seed не подтверждает каждое название.
  const marchandParticipation = await prisma.participation.upsert({
    where: { athleteId_editionId_nocId_sportId: { athleteId: athletes["leon-marchand"].id, editionId: editions["paris-2024"].id, nocId: nocs.FRA.id, sportId: sports.swimming.id } },
    update: { note: "Официальный отчёт Paris 2024 подтверждает четыре золотые медали." },
    create: { athleteId: athletes["leon-marchand"].id, editionId: editions["paris-2024"].id, nocId: nocs.FRA.id, sportId: sports.swimming.id, note: "Официальный отчёт Paris 2024 подтверждает четыре золотые медали." },
    select: { id: true },
  });
  await cite(sources.marchand.id, "Participation", marchandParticipation.id, "participation", "Подтверждает выступление и четыре золотые медали без детализации событий в seed.");

  await applyReleaseAudit(prisma);
  const counts = await Promise.all([
    prisma.olympicEdition.count(), prisma.athlete.count(), prisma.nationalOlympicCommittee.count(),
    prisma.sport.count(), prisma.medalResult.count(), prisma.knowledgeSource.count(),
  ]);
  console.log(`Seed complete: editions=${counts[0]}, athletes=${counts[1]}, nocs=${counts[2]}, sports=${counts[3]}, medalResults=${counts[4]}, sources=${counts[5]}`);
}

async function cite(sourceId: number, entityType: string, entityId: number, fieldName: string, note: string) {
  await prisma.factCitation.upsert({
    where: { sourceId_entityType_entityId_fieldName: { sourceId, entityType, entityId, fieldName } },
    update: { note }, create: { sourceId, entityType, entityId, fieldName, note },
  });
}

function medalRank(medal: MedalType) { return medal === MedalType.GOLD ? 1 : medal === MedalType.SILVER ? 2 : 3; }
function slugify(value: string) { return value.toLowerCase().replaceAll("ё", "е").replace(/[^a-zа-я0-9]+/gi, "-").replace(/(^-|-$)/g, ""); }
function twoEditionResults(athlete: string, noc: string, sport: string, first: string, second: string, events: string[], medal: MedalType, source: SourceKey, gender: string): ResultSeed[] {
  return [first, second].flatMap((edition) => events.map((event) => ({ athlete, edition, noc, sport, event, gender, medal, source })));
}
function phelpsResults(): ResultSeed[] {
  return [
    { athlete: "michael-phelps", edition: "london-2012", noc: "USA", sport: "swimming", event: "100 м баттерфляем", gender: "Мужчины", medal: MedalType.GOLD, source: "phelps" },
    { athlete: "michael-phelps", edition: "london-2012", noc: "USA", sport: "swimming", event: "200 м, комплексное плавание", gender: "Мужчины", medal: MedalType.GOLD, source: "phelps" },
    { athlete: "michael-phelps", edition: "london-2012", noc: "USA", sport: "swimming", event: "200 м баттерфляем", gender: "Мужчины", medal: MedalType.SILVER, source: "phelps" },
    { athlete: "michael-phelps", edition: "rio-2016", noc: "USA", sport: "swimming", event: "200 м баттерфляем", gender: "Мужчины", medal: MedalType.GOLD, source: "phelps" },
    { athlete: "michael-phelps", edition: "rio-2016", noc: "USA", sport: "swimming", event: "200 м, комплексное плавание", gender: "Мужчины", medal: MedalType.GOLD, source: "phelps" },
    { athlete: "michael-phelps", edition: "rio-2016", noc: "USA", sport: "swimming", event: "100 м баттерфляем", gender: "Мужчины", medal: MedalType.SILVER, source: "phelps" },
  ];
}

main().catch((error) => { console.error("Seed failed.", error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
