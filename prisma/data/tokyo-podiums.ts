type Entrant = readonly [
  slug: string, name: string, noc: string, rank: 1 | 2 | 3 | 5, mark: string, birthDate?: string,
];

type Podium = {
  slug: string; name: string; gender: "Женщины" | "Мужчины";
  discipline: "athletics" | "swimming" | "artistic-gymnastics";
  source: string; publisher: string; entrants: readonly Entrant[];
};

const athletics = "https://worldathletics.org/competition/calendar-results/results/7132391";
const athleticsPublisher = "World Athletics";

export const tokyoPodiums: Podium[] = [
  {
    slug: "athletics-100m-men", name: "100 м", gender: "Мужчины", discipline: "athletics",
    source: athletics + "?eventId=10229630&gender=M", publisher: athleticsPublisher,
    entrants: [
      ["lamont-marcell-jacobs", "Lamont Marcell Jacobs", "ITA", 1, "9,80 с", "1994-09-26"],
      ["fred-kerley", "Fred Kerley", "USA", 2, "9,84 с"],
      ["andre-de-grasse", "Andre De Grasse", "CAN", 3, "9,89 с"],
    ],
  },
  {
    slug: "athletics-100m-women", name: "100 м", gender: "Женщины", discipline: "athletics",
    source: "https://worldathletics.org/competitions/olympic-games/the-xxxi-olympic-games-7132391/results/women/100-metres/final/result",
    publisher: athleticsPublisher,
    entrants: [
      ["elaine-thompson-herah", "Elaine Thompson-Herah", "JAM", 1, "10,61 с", "1992-06-28"],
      ["shelly-ann-fraser-pryce", "Shelly-Ann Fraser-Pryce", "JAM", 2, "10,74 с", "1986-12-27"],
      ["shericka-jackson", "Shericka Jackson", "JAM", 3, "10,76 с"],
    ],
  },
  {
    slug: "athletics-high-jump-men", name: "Прыжки в высоту", gender: "Мужчины", discipline: "athletics",
    source: athletics + "?eventId=10229615", publisher: athleticsPublisher,
    entrants: [
      ["mutaz-essa-barshim", "Mutaz Essa Barshim", "QAT", 1, "2,37 м", "1991-06-24"],
      ["gianmarco-tamberi", "Gianmarco Tamberi", "ITA", 1, "2,37 м", "1992-06-01"],
      ["maksim-nedasekau", "Maksim Nedasekau", "BLR", 3, "2,37 м", "1998-01-21"],
    ],
  },
  {
    slug: "athletics-pole-vault-men", name: "Прыжки с шестом", gender: "Мужчины", discipline: "athletics",
    source: "https://worldathletics.org/competitions/olympic-games/la28/news/article/tokyo-olympic-games-men-pole-vault-report",
    publisher: athleticsPublisher,
    entrants: [
      ["armand-duplantis", "Armand Duplantis", "SWE", 1, "6,02 м"],
      ["christopher-nilsen", "Christopher Nilsen", "USA", 2, "5,97 м"],
      ["thiago-braz", "Thiago Braz", "BRA", 3, "5,87 м"],
    ],
  },
  {
    slug: "athletics-javelin-men", name: "Метание копья", gender: "Мужчины", discipline: "athletics",
    source: athletics + "?eventId=10229636", publisher: athleticsPublisher,
    entrants: [
      ["neeraj-chopra", "Neeraj Chopra", "IND", 1, "87,58 м", "1997-12-24"],
      ["jakub-vadlejch", "Jakub Vadlejch", "CZE", 2, "86,67 м", "1990-10-10"],
      ["vitezslav-vesely", "Vítězslav Veselý", "CZE", 3, "85,44 м", "1983-02-27"],
      ["arshad-nadeem", "Arshad Nadeem", "PAK", 5, "84,62 м", "1997-01-02"],
    ],
  },
  {
    slug: "swimming-1500m-freestyle-women", name: "1500 м, вольный стиль", gender: "Женщины", discipline: "swimming",
    source: "https://www.worldaquatics.com/news/2199923/ledecky-wins-1500m-free-ties-historical-feat",
    publisher: "World Aquatics",
    entrants: [
      ["katie-ledecky", "Katie Ledecky", "USA", 1, "15:37,34"],
      ["erica-sullivan", "Erica Sullivan", "USA", 2, "15:41,41"],
      ["sarah-wellbrock", "Sarah Köhler", "GER", 3, "15:42,91"],
    ],
  },
  {
    slug: "gymnastics-balance-beam-women", name: "Бревно", gender: "Женщины", discipline: "artistic-gymnastics",
    source: "https://static.usagym.org/PDFs/Results/2021/w_21olympics_bb.pdf",
    publisher: "Tokyo 2020 / USA Gymnastics",
    entrants: [
      ["guan-chenchen", "Guan Chenchen", "CHN", 1, "14,633"],
      ["tang-xijing", "Tang Xijing", "CHN", 2, "14,233"],
      ["simone-biles", "Simone Biles", "USA", 3, "14,000"],
    ],
  },
];
