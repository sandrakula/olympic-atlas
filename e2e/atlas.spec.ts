import { expect, test } from "@playwright/test";
import { examples, type Answer, type SearchPage } from "../src/lib/explore/model";

const paths = [
  "/", "/games", "/games/paris-2024", "/games/athens-1906",
  "/athletes", "/athletes/usain-bolt", "/athletes/leon-marchand", "/countries", "/countries/urs",
  "/sports#swimming", "/knowledge-graph", "/explore", "/analytics",
  "/compare/athletes?a=usain-bolt&b=michael-phelps", "/compare/games?a=paris-2024&b=athens-1906",
  "/compare/countries?a=noc:EUN&b=country:URS",
];
const runtimeErrors = new WeakMap<object, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(page.url() + " " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(page.url() + " " + message.text());
    }
  });
  // Emulate a CDN refusal without repeatedly requesting public image origins.
  await page.route((url) => url.pathname === "/_next/image" && url.searchParams.get("url")?.startsWith("https:") === true,
    (route) => route.fulfill({ status: 429 }));
});

test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

test("HTTP readiness, all ten rules and SQLite FTS5", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  const checked = new Set<string>();
  for (const { query, label } of examples) {
    await test.step(label, async () => {
      const response = await request.post("/api/explore", { data: { mode: "question", query } });
      expect(response.status()).toBe(200);
      const answer = await response.json() as Answer;
      expect(answer.intent).toBeTruthy();
      expect(["partial", "complete"]).toContain(answer.status);
      expect(answer.facts.some(({ sources }) => sources.length > 0)).toBe(true);
      checked.add(answer.intent ?? "");
    });
  }
  expect(checked.size).toBe(10);
  const lookup = await request.post("/api/explore", { data: { mode: "search", query: "Болт" } });
  expect(lookup.status()).toBe(200);
  expect((await lookup.json() as SearchPage).hits.some(({ label }) => label === "Усэйн Болт")).toBe(true);
});

for (const width of [375, 768, 1280, 1440, 1920]) {
  test("public routes fit viewport " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await test.step(path, async () => {
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
        await expect(page.locator("main h1")).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const rightmostControl = await page.locator("main button, main input, main select").evaluateAll((controls) =>
          controls.filter((control) => !control.closest("svg,.react-flow,.timeline-scroll,[data-local-scroll]"))
            .reduce((max, control) => Math.max(max, control.getBoundingClientRect().right), 0));
        expect(rightmostControl, path).toBeLessThanOrEqual(width);
      });
    }
  });
}

test("home, Games search, details, sources and image fallback", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("OLYMPIC");
  await page.getByRole("link", { name: "История Олимпиад", exact: true }).click();
  await page.getByPlaceholder("Год, название или город").fill("2024");
  await page.locator("article").filter({ hasText: "Париж" }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: "Париж" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Источники и права на изображения" })).toBeVisible();
  await expect(page.getByText("Rmpbedford", { exact: false }).first()).toBeVisible();
  await expect(page.locator("main img[alt*='Стад-де-Франс']")).toHaveCount(0);
  await expect(page.locator("main .summer-fallback")).toBeVisible();
});

test("athlete search, enriched profile and comparison", async ({ page }) => {
  await page.goto("/athletes");
  await page.getByRole("searchbox", { name: "Поиск спортсмена" }).fill("Усэйн Болт");
  await page.getByRole("searchbox", { name: "Поиск спортсмена" }).press("Enter");
  await page.getByRole("link", { name: /Усэйн Болт/ }).click();
  await expect(page.getByRole("heading", { name: "Усэйн Болт", exact: true })).toBeVisible();
  await expect(page.getByText("Пекин 2008", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Beijing 2008 — Men's 100 metres final/ })).toBeVisible();
  await page.goto("/compare/athletes");
  await page.locator("select[name=a]").selectOption("usain-bolt");
  await page.locator("select[name=b]").selectOption("michael-phelps");
  await page.getByRole("button", { name: "Сравнить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Подтверждённые медали в базе" })).toBeVisible();
});

test("expanded content links move from countries and sports to athletes and Games", async ({ page }) => {
  await page.goto("/countries?q=FRA");
  await expect(page.getByRole("img", { name: "Флаг · Франция" })).toBeVisible();
  await page.getByRole("link", { name: "Франция", exact: true }).click();
  await expect(page.getByRole("img", { name: "Флаг · Франция" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Все спортсмены страны/ })).toHaveAttribute("href", /country=FRA/);

  await page.goto("/sports#cycling");
  const cycling = page.locator("#cycling");
  await expect(cycling.getByRole("heading", { name: "Велоспорт" })).toBeVisible();
  await expect(cycling.getByText("Трековые велогонки")).toBeVisible();
  await expect(cycling.getByRole("link", { name: /Париж 2024/ })).toBeVisible();

  await page.goto("/games");
  const timeline = page.getByRole("navigation", { name: "Издания Олимпийских игр по годам" });
  await expect(timeline.getByRole("link", { name: /Токио 2020.*перенесены на 2021/i })).toContainText("2020 → 2021");
  await page.getByPlaceholder("Год, название или город").fill("2021");
  await expect(page.locator("article").getByText("Перенесены · проведены в 2021")).toBeVisible();
  await page.goto("/games/tokyo-2020");
  await expect(page.getByRole("heading", { name: "Токио 2020", exact: true })).toBeVisible();
  await expect(page.getByText("Перенесены · проведены в 2021")).toBeVisible();

  await page.goto("/athletes/leon-marchand");
  const portrait = page.getByRole("img", { name: "Фотография Леон Маршан" });
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute("src", /athletes%2Fq63246909/);
  await expect(page.getByRole("link", { name: "Оригинал на Wikimedia Commons" })).toBeVisible();
  await page.route((url) => url.pathname === "/_next/image" && url.searchParams.get("url")?.includes("q63246909") === true,
    (route) => route.fulfill({ status: 404 }));
  await page.reload();
  await expect(portrait).toHaveCount(0);
  await expect(page.getByText("ЛМ", { exact: true })).toBeVisible();

  await page.goto("/games/paris-2024?results=2#results");
  await expect(page.getByRole("navigation", { name: "Страницы медальных результатов" })).toContainText("Страница 2");
  await expect(page.getByText(/1[\s\u00a0]044 медальным записям/)).toBeVisible();
});

test("graph search, neighborhoods, sources and navigation from a logical answer", async ({ page }) => {
  await page.goto("/knowledge-graph");
  await page.getByRole("link", { name: "Исследование связей", exact: true }).click();
  await page.getByRole("searchbox", { name: "Поиск по графу" }).fill("Симона Байлз");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: /Симона Байлз/ }).first().click();
  const inspector = page.getByRole("complementary", { name: "Инспектор графа" });
  await expect(inspector.getByText("Симона Байлз", { exact: true }).first()).toBeVisible();
  const evidence = inspector.getByRole("button", { name: /Происхождение связи:/ }).first();
  await expect(evidence).toBeVisible();
  await evidence.click();
  await expect(inspector.getByText("Факт из SQLite", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("link", { name: /Simone Biles/ })).toBeVisible();
  await inspector.getByRole("button", { name: "К объекту" }).click();
  await inspector.getByRole("button", { name: "Задать начало" }).click();
  await page.getByRole("button", { name: "Увеличить", exact: true }).click();
  await page.getByRole("searchbox", { name: "Поиск по графу" }).fill("Рио 2016");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: /Рио-де-Жанейро 2016/ }).first().click();
  await expect(inspector.getByRole("heading", { name: /Рио-де-Жанейро 2016/ })).toBeVisible();
  const expand = inspector.getByRole("button", { name: "Раскрыть связи" });
  await expect(expand).toBeEnabled();
  await expand.click();
  await inspector.getByRole("button", { name: "Задать конец" }).click();
  await inspector.getByRole("button", { name: "Найти путь" }).click();
  await expect(inspector.getByRole("list", { name: "Найденный путь" }).getByRole("listitem")).toHaveCount(3);
  await page.goto("/explore");
  const question = page.getByRole("combobox", { name: "Вопрос об Олимпийских играх" });
  await question.fill("На каких Олимпиадах выступала Симона Байлз?");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.locator("#atlas-answer")).toBeVisible();
  await expect(page.locator("main").getByText(/Рио-де-Жанейро 2016/).first()).toBeVisible();
  await expect(page.locator('main a[href*="/knowledge-graph?node="]').first()).toBeVisible();
});

test("analytics filters and comparison of two editions and historical delegations", async ({ page }) => {
  await page.goto("/analytics");
  await page.getByRole("combobox", { name: "Сезон", exact: true }).selectOption("WINTER");
  await page.getByRole("combobox", { name: "Вид спорта", exact: true }).selectOption("freestyle-skiing");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page.getByRole("heading", { name: "3 медальных записей в выборке" })).toBeVisible();
  const medals = page.locator('section[aria-labelledby="medals"]');
  await medals.locator("path.recharts-rectangle").first().hover();
  await expect(medals.locator(".recharts-tooltip-wrapper")).toContainText("Золото");
  await page.getByRole("link", { name: "Сравнить Игры", exact: true }).click();
  await page.getByRole("combobox", { name: "Первое издание" }).selectOption("paris-2024");
  await page.getByRole("combobox", { name: "Второе издание" }).selectOption("athens-1906");
  await page.getByRole("button", { name: "Сравнить", exact: true }).click();
  await expect(page.locator("article dd").getByText("Нет данных", { exact: true })).toHaveCount(4);
  await page.goto("/compare/countries?a=noc:EUN&b=country:URS");
  await expect(page.getByRole("heading", { name: "Объединённая команда" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "СССР", exact: true })).toBeVisible();
});

test("mobile navigation and keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Перейти к содержанию" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#atlas-content")).toBeFocused();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  const menu = page.getByRole("navigation", { name: "Мобильная навигация" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "Открыть меню" })).toBeFocused();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await menu.getByRole("link", { name: "Аналитика" }).click();
  await expect(page.getByRole("heading", { name: "Олимпийская аналитика" })).toBeVisible();
});

test("metadata, sitemap, robots and missing records", async ({ page, request }) => {
  await page.goto("/games/paris-2024");
  await expect(page).toHaveTitle(/Париж 2024.*OLYMPIC ATLAS/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/images\/hero-athlete.png$/);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /api/");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/athletes/usain-bolt</loc>");
  for (const path of ["/missing", "/games/not-a-game", "/athletes/not-an-athlete", "/countries/zzz", "/games/999999999999999"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "Такого объекта нет в базе" })).toBeVisible();
  }
});

test("editorial cards distinguish photos, missing records and historical identities", async ({ page }) => {
  await page.goto("/athletes?sort=name");
  const grid = page.locator(".atlas-athletes-grid");
  await expect(grid.getByRole("link")).toHaveCount(24);
  await expect(grid.locator(".atlas-tile-monogram").first()).toBeVisible();
  expect(await grid.getByRole("link").first().evaluate((card) => card.getBoundingClientRect().height)).toBeLessThan(225);
  await page.getByRole("navigation", { name: "Страницы спортсменов" }).getByRole("link", { name: "Дальше" }).click();
  await expect(page.getByRole("navigation", { name: "Страницы спортсменов" })).toContainText("Страница 2");

  await page.goto("/athletes?q=Леон+Маршан");
  await expect(grid.getByRole("img", { name: "Фотография Леон Маршан" })).toBeVisible();
  await expect(grid.getByRole("img", { name: "Флаг · Франция" })).toBeVisible();
  await expect(grid.getByText(/Медалей · /)).toBeVisible();

  await page.goto("/countries?q=URS");
  const historic = page.locator("article[data-historical=true]").filter({ hasText: "СССР" });
  await expect(historic.getByText("URS", { exact: true }).first()).toBeVisible();
  await expect(historic.getByRole("img")).toHaveCount(0);
  await expect(historic.locator("dd", { hasText: "—" })).not.toHaveCount(0);

  await page.goto("/sports");
  const sports = page.locator("article.atlas-sport-card");
  await expect(sports).toHaveCount(39);
  expect(await sports.locator(".atlas-sport-card-heading > svg:first-child").evaluateAll((icons) =>
    new Set(icons.map((icon) => icon.innerHTML)).size)).toBe(39);
  await expect(page.locator(".atlas-sport-covers figure")).toHaveCount(4);
  for (const cover of await page.locator(".atlas-sport-covers figure").all()) {
    await expect(cover.getByRole("img")).toBeVisible();
    await expect(cover.getByRole("link", { name: /CC BY/ })).toHaveAttribute("href", /^https:\/\/creativecommons\.org\//);
  }
});

test("the Games timeline jumps by era and exposes cancelled and postponed editions", async ({ page }) => {
  await page.goto("/games");
  const timeline = page.getByRole("navigation", { name: "Издания Олимпийских игр по годам" });
  await page.getByRole("group", { name: "Перейти к году" }).getByRole("button", { name: "2020" }).click();
  const tokyo = timeline.getByRole("link", { name: /Токио 2020.*2021/ });
  await expect(tokyo).toBeFocused();
  await expect(tokyo).toBeInViewport();
  await page.keyboard.press("Home");
  await expect(timeline.getByRole("link", { name: /Афины 1896/ })).toBeFocused();
  await page.getByRole("group", { name: "Статус" }).getByRole("button", { name: "Особые" }).click();
  await page.getByRole("button", { name: "1896–1944" }).click();
  await expect(page.locator("article[data-status=CANCELLED]")).toHaveCount(5);
});
