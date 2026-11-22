import { OlympicEditionStatus, OlympicSeason } from "../../src/generated/prisma/client";

export type HostCountrySeed = {
  code: string;
  name: string;
  region: string;
  historicalName?: string;
  activeFrom?: number;
  activeTo?: number;
};

export type OlympicEditionSeed = {
  slug: string;
  year: number;
  heldYear?: number;
  season: OlympicSeason;
  status?: OlympicEditionStatus;
  startDate?: string;
  endDate?: string;
  hostCity: string;
  host: string | null;
  athleteCount?: number;
  delegationCount?: number;
  sportCount?: number;
  eventCount?: number;
  historicalNote?: string;
  statisticsNote?: string;
};

export const olympicHostCountries: HostCountrySeed[] = [
  { code: "GRC", name: "Греция", region: "Европа" },
  { code: "FRA", name: "Франция", region: "Европа" },
  { code: "USA", name: "США", region: "Северная Америка" },
  { code: "GBR", name: "Великобритания", region: "Европа" },
  { code: "SWE", name: "Швеция", region: "Европа" },
  { code: "BEL", name: "Бельгия", region: "Европа" },
  { code: "NLD", name: "Нидерланды", region: "Европа" },
  { code: "DEU", name: "Германия", region: "Европа" },
  { code: "CHE", name: "Швейцария", region: "Европа" },
  { code: "FIN", name: "Финляндия", region: "Европа" },
  { code: "AUS", name: "Австралия", region: "Океания" },
  { code: "ITA", name: "Италия", region: "Европа" },
  { code: "JPN", name: "Япония", region: "Азия" },
  { code: "MEX", name: "Мексика", region: "Северная Америка" },
  { code: "CAN", name: "Канада", region: "Северная Америка" },
  { code: "ESP", name: "Испания", region: "Европа" },
  { code: "NOR", name: "Норвегия", region: "Европа" },
  { code: "AUT", name: "Австрия", region: "Европа" },
  { code: "BRA", name: "Бразилия", region: "Южная Америка" },
  { code: "CHN", name: "Китай", region: "Азия" },
  { code: "KOR", name: "Республика Корея", region: "Азия" },
  { code: "RUS", name: "Россия", region: "Европа и Азия" },
  { code: "YUG", name: "Югославия", region: "Европа", historicalName: "Социалистическая Федеративная Республика Югославия", activeFrom: 1918, activeTo: 2003 },
  { code: "URS", name: "СССР", region: "Европа и Азия", historicalName: "Союз Советских Социалистических Республик", activeFrom: 1922, activeTo: 1991 },
  { code: "FRG", name: "ФРГ", region: "Европа", historicalName: "Федеративная Республика Германия до объединения", activeFrom: 1949, activeTo: 1990 },
];

const S = OlympicSeason.SUMMER;
const W = OlympicSeason.WINTER;
const C = OlympicEditionStatus.CANCELLED;
const I = OlympicEditionStatus.INTERCALATED;

export const olympicEditions: OlympicEditionSeed[] = [
  { slug: "athens-1896", year: 1896, season: S, startDate: "1896-04-06", endDate: "1896-04-15", hostCity: "Афины", host: "GRC", athleteCount: 241, delegationCount: 14, sportCount: 9, eventCount: 43, historicalNote: "Первые Олимпийские игры современности." },
  { slug: "paris-1900", year: 1900, season: S, startDate: "1900-05-14", endDate: "1900-10-28", hostCity: "Париж", host: "FRA", athleteCount: 997, delegationCount: 24, sportCount: 19, eventCount: 95, historicalNote: "Игры прошли в рамках Всемирной выставки; женщины впервые участвовали в олимпийских соревнованиях." },
  { slug: "st-louis-1904", year: 1904, season: S, startDate: "1904-07-01", endDate: "1904-11-23", hostCity: "Сент-Луис", host: "USA", athleteCount: 651, delegationCount: 12, sportCount: 16, eventCount: 95, historicalNote: "Первые Олимпийские игры за пределами Европы." },
  { slug: "athens-1906", year: 1906, season: S, status: I, startDate: "1906-04-22", endDate: "1906-05-02", hostCity: "Афины", host: "GRC", historicalNote: "Межолимпийские игры 1906 года: исторически значимое соревнование, которое IOC не признаёт отдельным официальным изданием Олимпийских игр.", statisticsNote: "Не входит в итог 55 официально состоявшихся изданий." },
  { slug: "london-1908", year: 1908, season: S, startDate: "1908-04-27", endDate: "1908-10-31", hostCity: "Лондон", host: "GBR", athleteCount: 2008, delegationCount: 22, sportCount: 22, eventCount: 110 },
  { slug: "stockholm-1912", year: 1912, season: S, startDate: "1912-05-05", endDate: "1912-07-27", hostCity: "Стокгольм", host: "SWE", athleteCount: 2407, delegationCount: 28, sportCount: 14, eventCount: 102, historicalNote: "Первые Игры с участниками со всех пяти континентов." },
  { slug: "berlin-1916-cancelled", year: 1916, season: S, status: C, hostCity: "Берлин", host: "DEU", historicalNote: "Игры VI Олимпиады не состоялись из-за Первой мировой войны." },
  { slug: "antwerp-1920", year: 1920, season: S, startDate: "1920-04-20", endDate: "1920-09-12", hostCity: "Антверпен", host: "BEL", athleteCount: 2626, delegationCount: 29, sportCount: 22, eventCount: 156, historicalNote: "На церемонии открытия впервые использовали олимпийский флаг и произнесли олимпийскую клятву." },
  { slug: "chamonix-1924", year: 1924, season: W, startDate: "1924-01-25", endDate: "1924-02-05", hostCity: "Шамони", host: "FRA", athleteCount: 258, delegationCount: 16, sportCount: 6, eventCount: 16, historicalNote: "Международная неделя зимних видов спорта была ретроспективно признана первыми зимними Олимпийскими играми." },
  { slug: "paris-1924", year: 1924, season: S, startDate: "1924-05-04", endDate: "1924-07-27", hostCity: "Париж", host: "FRA", athleteCount: 3088, delegationCount: 44, sportCount: 17, eventCount: 126 },
  { slug: "st-moritz-1928", year: 1928, season: W, startDate: "1928-02-11", endDate: "1928-02-19", hostCity: "Санкт-Мориц", host: "CHE", athleteCount: 464, delegationCount: 25, sportCount: 4, eventCount: 14 },
  { slug: "amsterdam-1928", year: 1928, season: S, startDate: "1928-05-17", endDate: "1928-08-12", hostCity: "Амстердам", host: "NLD", athleteCount: 2883, delegationCount: 46, sportCount: 14, eventCount: 109, historicalNote: "На стадионе впервые зажгли символический олимпийский огонь." },
  { slug: "lake-placid-1932", year: 1932, season: W, startDate: "1932-02-04", endDate: "1932-02-15", hostCity: "Лейк-Плэсид", host: "USA", athleteCount: 252, delegationCount: 17, sportCount: 4, eventCount: 14 },
  { slug: "los-angeles-1932", year: 1932, season: S, startDate: "1932-07-30", endDate: "1932-08-14", hostCity: "Лос-Анджелес", host: "USA", athleteCount: 1334, delegationCount: 37, sportCount: 14, eventCount: 117 },
  { slug: "garmisch-partenkirchen-1936", year: 1936, season: W, startDate: "1936-02-06", endDate: "1936-02-16", hostCity: "Гармиш-Партенкирхен", host: "DEU", athleteCount: 646, delegationCount: 28, sportCount: 4, eventCount: 17 },
  { slug: "berlin-1936", year: 1936, season: S, startDate: "1936-08-01", endDate: "1936-08-16", hostCity: "Берлин", host: "DEU", athleteCount: 3963, delegationCount: 49, sportCount: 19, eventCount: 129, historicalNote: "Первые Игры с эстафетой олимпийского огня и телевизионными трансляциями." },
  { slug: "sapporo-1940-cancelled", year: 1940, season: W, status: C, hostCity: "Саппоро / Санкт-Мориц / Гармиш-Партенкирхен", host: null, historicalNote: "Зимние Игры 1940 года последовательно меняли место проведения и были отменены из-за Второй мировой войны." },
  { slug: "tokyo-helsinki-1940-cancelled", year: 1940, season: S, status: C, hostCity: "Токио / Хельсинки", host: null, historicalNote: "Игры XII Олимпиады были перенесены из Токио в Хельсинки, а затем отменены из-за Второй мировой войны." },
  { slug: "cortina-1944-cancelled", year: 1944, season: W, status: C, hostCity: "Кортина-д’Ампеццо", host: "ITA", historicalNote: "Зимние Игры 1944 года не состоялись из-за Второй мировой войны." },
  { slug: "london-1944-cancelled", year: 1944, season: S, status: C, hostCity: "Лондон", host: "GBR", historicalNote: "Игры XIII Олимпиады не состоялись из-за Второй мировой войны." },
  { slug: "st-moritz-1948", year: 1948, season: W, startDate: "1948-01-30", endDate: "1948-02-08", hostCity: "Санкт-Мориц", host: "CHE", athleteCount: 669, delegationCount: 28, sportCount: 4, eventCount: 22 },
  { slug: "london-1948", year: 1948, season: S, startDate: "1948-07-29", endDate: "1948-08-14", hostCity: "Лондон", host: "GBR", athleteCount: 4104, delegationCount: 59, sportCount: 17, eventCount: 136, historicalNote: "Первые летние Игры после двенадцатилетнего перерыва, известные как «Игры строгой экономии»." },
  { slug: "oslo-1952", year: 1952, season: W, startDate: "1952-02-14", endDate: "1952-02-25", hostCity: "Осло", host: "NOR", athleteCount: 694, delegationCount: 30, sportCount: 4, eventCount: 22 },
  { slug: "helsinki-1952", year: 1952, season: S, startDate: "1952-07-19", endDate: "1952-08-03", hostCity: "Хельсинки", host: "FIN", athleteCount: 4955, delegationCount: 69, sportCount: 17, eventCount: 149 },
  { slug: "cortina-1956", year: 1956, season: W, startDate: "1956-01-26", endDate: "1956-02-05", hostCity: "Кортина-д’Ампеццо", host: "ITA", athleteCount: 821, delegationCount: 32, sportCount: 4, eventCount: 24 },
  { slug: "melbourne-1956", year: 1956, season: S, startDate: "1956-11-22", endDate: "1956-12-08", hostCity: "Мельбурн / Стокгольм", host: "AUS", athleteCount: 3155, delegationCount: 67, sportCount: 16, eventCount: 145, historicalNote: "Из-за австралийских карантинных правил конные соревнования прошли отдельно в Стокгольме 10–17 июня." },
  { slug: "squaw-valley-1960", year: 1960, season: W, startDate: "1960-02-18", endDate: "1960-02-28", hostCity: "Скво-Вэлли (ныне Пэлисейдс-Тахо)", host: "USA", athleteCount: 665, delegationCount: 30, sportCount: 4, eventCount: 27 },
  { slug: "rome-1960", year: 1960, season: S, startDate: "1960-08-25", endDate: "1960-09-11", hostCity: "Рим", host: "ITA", athleteCount: 5338, delegationCount: 83, sportCount: 17, eventCount: 150 },
  { slug: "innsbruck-1964", year: 1964, season: W, startDate: "1964-01-29", endDate: "1964-02-09", hostCity: "Инсбрук", host: "AUT", athleteCount: 1091, delegationCount: 36, sportCount: 6, eventCount: 34 },
  { slug: "tokyo-1964", year: 1964, season: S, startDate: "1964-10-10", endDate: "1964-10-24", hostCity: "Токио", host: "JPN", athleteCount: 5152, delegationCount: 93, sportCount: 19, eventCount: 163, historicalNote: "Первые Олимпийские игры, проведённые в Азии." },
  { slug: "grenoble-1968", year: 1968, season: W, startDate: "1968-02-06", endDate: "1968-02-18", hostCity: "Гренобль", host: "FRA", athleteCount: 1158, delegationCount: 37, sportCount: 6, eventCount: 35 },
  { slug: "mexico-city-1968", year: 1968, season: S, startDate: "1968-10-12", endDate: "1968-10-27", hostCity: "Мехико", host: "MEX", athleteCount: 5516, delegationCount: 112, sportCount: 18, eventCount: 172, historicalNote: "Первые Олимпийские игры в Латинской Америке." },
  { slug: "sapporo-1972", year: 1972, season: W, startDate: "1972-02-03", endDate: "1972-02-13", hostCity: "Саппоро", host: "JPN", athleteCount: 1006, delegationCount: 35, sportCount: 6, eventCount: 35 },
  { slug: "munich-1972", year: 1972, season: S, startDate: "1972-08-26", endDate: "1972-09-11", hostCity: "Мюнхен", host: "FRG", athleteCount: 7134, delegationCount: 121, sportCount: 23, eventCount: 195, historicalNote: "Игры были приостановлены на 34 часа после террористического нападения 5 сентября." },
  { slug: "innsbruck-1976", year: 1976, season: W, startDate: "1976-02-04", endDate: "1976-02-15", hostCity: "Инсбрук", host: "AUT", athleteCount: 1123, delegationCount: 37, sportCount: 6, eventCount: 37, historicalNote: "Инсбрук принял Игры после отказа первоначально выбранного Денвера." },
  { slug: "montreal-1976", year: 1976, season: S, startDate: "1976-07-17", endDate: "1976-08-01", hostCity: "Монреаль", host: "CAN", athleteCount: 6084, delegationCount: 92, sportCount: 21, eventCount: 198 },
  { slug: "lake-placid-1980", year: 1980, season: W, startDate: "1980-02-13", endDate: "1980-02-24", hostCity: "Лейк-Плэсид", host: "USA", athleteCount: 1072, delegationCount: 37, sportCount: 6, eventCount: 38 },
  { slug: "moscow-1980", year: 1980, season: S, startDate: "1980-07-19", endDate: "1980-08-03", hostCity: "Москва", host: "URS", athleteCount: 5179, delegationCount: 80, sportCount: 21, eventCount: 203, historicalNote: "Масштабный бойкот сократил число участвовавших делегаций до 80." },
  { slug: "sarajevo-1984", year: 1984, season: W, startDate: "1984-02-08", endDate: "1984-02-19", hostCity: "Сараево", host: "YUG", athleteCount: 1272, delegationCount: 49, sportCount: 6, eventCount: 39 },
  { slug: "los-angeles-1984", year: 1984, season: S, startDate: "1984-07-28", endDate: "1984-08-12", hostCity: "Лос-Анджелес", host: "USA", athleteCount: 6829, delegationCount: 140, sportCount: 21, eventCount: 221 },
  { slug: "calgary-1988", year: 1988, season: W, startDate: "1988-02-13", endDate: "1988-02-28", hostCity: "Калгари", host: "CAN", athleteCount: 1423, delegationCount: 57, sportCount: 6, eventCount: 46 },
  { slug: "seoul-1988", year: 1988, season: S, startDate: "1988-09-17", endDate: "1988-10-02", hostCity: "Сеул", host: "KOR", athleteCount: 8397, delegationCount: 159, sportCount: 23, eventCount: 237 },
  { slug: "albertville-1992", year: 1992, season: W, startDate: "1992-02-08", endDate: "1992-02-23", hostCity: "Альбервиль", host: "FRA", athleteCount: 1801, delegationCount: 64, sportCount: 7, eventCount: 57 },
  { slug: "barcelona-1992", year: 1992, season: S, startDate: "1992-07-25", endDate: "1992-08-09", hostCity: "Барселона", host: "ESP", athleteCount: 9356, delegationCount: 169, sportCount: 25, eventCount: 257 },
  { slug: "lillehammer-1994", year: 1994, season: W, startDate: "1994-02-12", endDate: "1994-02-27", hostCity: "Лиллехаммер", host: "NOR", athleteCount: 1737, delegationCount: 67, sportCount: 6, eventCount: 61, historicalNote: "Первые зимние Игры, проведённые в отдельном от летних двухлетнем цикле." },
  { slug: "atlanta-1996", year: 1996, season: S, startDate: "1996-07-19", endDate: "1996-08-04", hostCity: "Атланта", host: "USA", athleteCount: 10318, delegationCount: 197, sportCount: 26, eventCount: 271 },
  { slug: "nagano-1998", year: 1998, season: W, startDate: "1998-02-07", endDate: "1998-02-22", hostCity: "Нагано", host: "JPN", athleteCount: 2176, delegationCount: 72, sportCount: 7, eventCount: 68 },
  { slug: "sydney-2000", year: 2000, season: S, startDate: "2000-09-15", endDate: "2000-10-01", hostCity: "Сидней", host: "AUS", athleteCount: 10651, delegationCount: 199, sportCount: 28, eventCount: 300, statisticsNote: "Дополнительно участвовали четыре индивидуальных олимпийских спортсмена." },
  { slug: "salt-lake-city-2002", year: 2002, season: W, startDate: "2002-02-08", endDate: "2002-02-24", hostCity: "Солт-Лейк-Сити", host: "USA", athleteCount: 2399, delegationCount: 77, sportCount: 7, eventCount: 78 },
  { slug: "athens-2004", year: 2004, season: S, startDate: "2004-08-13", endDate: "2004-08-29", hostCity: "Афины", host: "GRC", athleteCount: 10625, delegationCount: 201, sportCount: 28, eventCount: 301 },
  { slug: "turin-2006", year: 2006, season: W, startDate: "2006-02-10", endDate: "2006-02-26", hostCity: "Турин", host: "ITA", athleteCount: 2508, delegationCount: 80, sportCount: 7, eventCount: 84 },
  { slug: "beijing-2008", year: 2008, season: S, startDate: "2008-08-08", endDate: "2008-08-24", hostCity: "Пекин", host: "CHN", athleteCount: 10942, delegationCount: 204, sportCount: 28, eventCount: 302 },
  { slug: "vancouver-2010", year: 2010, season: W, startDate: "2010-02-12", endDate: "2010-02-28", hostCity: "Ванкувер", host: "CAN", athleteCount: 2566, delegationCount: 82, sportCount: 7, eventCount: 86 },
  { slug: "london-2012", year: 2012, season: S, startDate: "2012-07-27", endDate: "2012-08-12", hostCity: "Лондон", host: "GBR", athleteCount: 10568, delegationCount: 204, sportCount: 26, eventCount: 302, statisticsNote: "Дополнительно участвовали четыре индивидуальных олимпийских спортсмена." },
  { slug: "sochi-2014", year: 2014, season: W, startDate: "2014-02-07", endDate: "2014-02-23", hostCity: "Сочи", host: "RUS", athleteCount: 2780, delegationCount: 88, sportCount: 7, eventCount: 98 },
  { slug: "rio-2016", year: 2016, season: S, startDate: "2016-08-05", endDate: "2016-08-21", hostCity: "Рио-де-Жанейро", host: "BRA", athleteCount: 11238, delegationCount: 205, sportCount: 28, eventCount: 306, historicalNote: "Первые Олимпийские игры в Южной Америке." },
  { slug: "pyeongchang-2018", year: 2018, season: W, startDate: "2018-02-09", endDate: "2018-02-25", hostCity: "Пхёнчхан", host: "KOR", athleteCount: 2833, delegationCount: 92, sportCount: 7, eventCount: 102 },
  { slug: "tokyo-2020", year: 2020, heldYear: 2021, season: S, startDate: "2021-07-23", endDate: "2021-08-08", hostCity: "Токио", host: "JPN", athleteCount: 11420, delegationCount: 205, sportCount: 33, eventCount: 339, historicalNote: "Из-за пандемии COVID-19 Игры были перенесены на 2021 год, сохранив официальное название Tokyo 2020.", statisticsNote: "Также участвовали независимые олимпийские спортсмены и Олимпийская сборная беженцев." },
  { slug: "beijing-2022", year: 2022, season: W, startDate: "2022-02-04", endDate: "2022-02-20", hostCity: "Пекин", host: "CHN", athleteCount: 2834, delegationCount: 91, sportCount: 7, eventCount: 109, historicalNote: "Пекин стал первым городом, принявшим и летние, и зимние Олимпийские игры." },
  { slug: "paris-2024", year: 2024, season: S, startDate: "2024-07-26", endDate: "2024-08-11", hostCity: "Париж", host: "FRA", athleteCount: 10813, delegationCount: 206, sportCount: 32, eventCount: 329, historicalNote: "Первые Игры с равным распределением квот между женщинами и мужчинами.", statisticsNote: "204 НОК, Олимпийская сборная беженцев и индивидуальные нейтральные спортсмены." },
  { slug: "milano-cortina-2026", year: 2026, season: W, startDate: "2026-02-06", endDate: "2026-02-22", hostCity: "Милан и Кортина-д’Ампеццо", host: "ITA", athleteCount: 2900, delegationCount: 92, sportCount: 8, eventCount: 116, historicalNote: "Первые зимние Игры с распределённой моделью проведения по нескольким кластерам северной Италии; дебют ски-альпинизма.", statisticsNote: "IOC указывает около 2 900 спортсменов; 92 НОК плюс индивидуальные нейтральные спортсмены." },
];

export const catalogCoverage = {
  held: 55,
  summerHeld: 30,
  winterHeld: 25,
  cancelled: 5,
  intercalated: 1,
  totalRecords: 61,
} as const;
