import { expect, test, type Page } from "@playwright/test";

const workspace = (page: Page) => page.getByRole("region", { name: "Олимпийская вселенная", exact: true });
const inspector = (page: Page) => workspace(page).getByRole("complementary", { name: "Инспектор карты" });
const node = (page: Page, label: string) => workspace(page).locator(".react-flow__node").filter({ hasText: label }).first();

async function capture(page: Page, file: string) {
  if (!process.env.ATLAS_UNIVERSE_CAPTURE) return;
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.screenshot({ path: `docs/screenshots/${file}.jpg`, type: "jpeg", quality: 90, animations: "disabled" });
}

test("desktop map drills from six eras to Paris athletes, pages and attributable sources", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/knowledge-graph");
  await expect(page.getByRole("heading", { name: "Олимпийская вселенная" })).toBeVisible();
  const map = workspace(page);
  await expect(map.locator(".react-flow__node")).toHaveCount(6);
  await expect(map.getByText(/61 изданий в срезе/)).toBeVisible();
  await expect(node(page, "Первые Игры")).toBeInViewport();
  await capture(page, "universe-overview");

  await node(page, "Новейшая история").focus();
  await page.keyboard.press("Enter");
  await expect(map.getByRole("heading", { name: "Новейшая история", exact: true })).toBeVisible();
  await expect(node(page, "Токио 2020 / 2021")).toBeVisible();
  await expect(node(page, "Париж 2024")).toBeInViewport();
  await capture(page, "universe-era");
  await node(page, "Париж 2024").click();
  await expect(inspector(page).getByRole("heading", { name: "Париж 2024", exact: true })).toBeVisible();
  await expect(inspector(page).getByText("Официальная статистика издания")).toBeVisible();
  await inspector(page).getByRole("button", { name: /Виды спорта/ }).click();
  await expect(map.getByRole("heading", { name: "Виды спорта", exact: true })).toBeVisible();
  await expect(node(page, "Плавание")).toBeInViewport();
  await expect(node(page, "Лёгкая атлетика")).toBeVisible();
  await capture(page, "universe-paris-sports");
  await node(page, "Плавание").click();
  await expect(inspector(page).getByRole("heading", { name: "Плавание", exact: true })).toBeVisible();
  await inspector(page).getByRole("button", { name: /Спортсмены/ }).click();
  await expect(map.getByRole("navigation", { name: "Страницы кластера" })).toContainText("Страница 1");
  await map.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(map.getByRole("navigation", { name: "Страницы кластера" })).toContainText("Страница 2");
  await expect(map.locator(".react-flow__node")).toHaveCount(13);
  await map.getByRole("button", { name: "Список узлов" }).click();
  await map.getByLabel("Узлы текущего уровня").getByRole("button").nth(1).click();
  await expect(inspector(page).getByRole("link", { name: "Профиль спортсмена" })).toBeVisible();
  await inspector(page).getByRole("button", { name: /Источники/ }).click();
  await expect(map.getByRole("heading", { name: "Источники", exact: true })).toBeVisible();
  await map.getByLabel("Узлы текущего уровня").getByRole("button").nth(1).click();
  await expect(inspector(page).getByText("Цитируемые поля")).toBeVisible();
  await expect(inspector(page).getByRole("link", { name: "Открыть источник" })).toBeVisible();
});

test("desktop timeline, scoped search, exact graph and deep link", async ({ page }) => {
  await page.goto("/knowledge-graph");
  const map = workspace(page);
  await map.getByRole("button", { name: "На весь экран" }).click();
  await expect(map).toHaveAttribute("data-fullscreen", "native");
  await expect(map.getByRole("searchbox")).toBeVisible();
  await map.getByRole("button", { name: "Выйти из полного экрана" }).click();
  await expect(map).not.toHaveAttribute("data-fullscreen", "native");
  await map.getByRole("button", { name: "Путь Игр" }).click();
  const timeline = map.getByRole("region", { name: "Путь Олимпийских игр" });
  const cursor = timeline.getByRole("slider", { name: "Позиция в хронологии" });
  await expect(cursor).toHaveAttribute("aria-valuetext", "Афины 1896");
  await timeline.getByRole("button", { name: "Отмены 1916–1944" }).click();
  await expect(cursor).toHaveAttribute("aria-valuetext", "Берлин 1916");
  await timeline.getByRole("button", { name: "Возобновление в 1948" }).click();
  await expect(cursor).toHaveAttribute("aria-valuetext", /1948/);
  await timeline.getByRole("button", { name: "Токио 2020 / 2021" }).click();
  await expect(cursor).toHaveAttribute("aria-valuetext", "Токио 2020 / 2021");
  await cursor.focus();
  await page.keyboard.press("End");
  await expect(cursor).toHaveAttribute("aria-valuetext", /Кортина.*2026/);
  await timeline.getByRole("button", { name: "Данные издания" }).click();
  await expect(inspector(page).getByRole("link", { name: "Досье Олимпиады" })).toHaveAttribute("href", "/games/milano-cortina-2026");

  await map.getByRole("button", { name: "Фильтры" }).click();
  await map.getByRole("combobox", { name: "Сезон", exact: true }).selectOption("WINTER");
  await expect(map.getByText(/27 изданий в срезе/)).toBeVisible();
  const search = map.getByRole("searchbox", { name: "Поиск по Олимпийской вселенной" });
  await search.fill("Paris 2024");
  await search.press("Enter");
  await expect(map.getByText("В этом срезе ничего не найдено")).toBeVisible();
  await map.getByRole("button", { name: "Сбросить" }).click();
  await expect(map.getByText(/61 изданий в срезе/)).toBeVisible();
  await search.fill("Симона Байлз");
  await search.press("Enter");
  await map.getByRole("button", { name: /Симона Байлз/ }).click();
  await expect(map.getByRole("navigation", { name: "Уровни карты" })).toContainText("Париж 2024");
  await expect(map.getByRole("navigation", { name: "Уровни карты" })).toContainText("Спортивная гимнастика");
  await expect(inspector(page).getByRole("heading", { name: "Симона Байлз" })).toBeVisible();
  await inspector(page).getByRole("link", { name: "Исследовать точные связи" }).click();
  await expect(page.getByRole("complementary", { name: "Инспектор графа" }).getByRole("heading", { name: "Симона Байлз" })).toBeVisible();

  await page.goto("/games/paris-2024");
  await page.getByRole("link", { name: "Открыть на карте Олимпийской вселенной" }).click();
  await expect(inspector(page).getByRole("heading", { name: "Париж 2024", exact: true })).toBeVisible();
});

for (const width of [375, 768]) test(`map at ${width}px supports keyboard, inspector drawer and fullscreen fallback`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 375 ? 1120 : 1024 });
  await page.addInitScript(() => { Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined }); });
  await page.goto("/knowledge-graph");
  const map = workspace(page);
  await expect(map.locator(".react-flow__node")).toHaveCount(6);
  await expect(node(page, "Первые Игры")).toBeInViewport();
  await expect.poll(async () => map.locator(".react-flow").evaluate((canvas) => {
    const bounds = canvas.getBoundingClientRect();
    const cards = [...canvas.querySelectorAll(".react-flow__node")].map((element) => element.getBoundingClientRect());
    const left = Math.min(...cards.map((card) => card.left)) - bounds.left;
    const right = bounds.right - Math.max(...cards.map((card) => card.right));
    return Math.abs(left - right);
  })).toBeLessThan(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if (width === 375) await capture(page, "universe-mobile");
  await map.getByRole("button", { name: "Инспектор", exact: true }).click();
  const dialog = map.getByRole("dialog", { name: "Инспектор карты" });
  await expect(dialog.getByRole("heading", { name: "Первые Игры" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await map.getByRole("button", { name: "На весь экран" }).click();
  await expect(map).toHaveAttribute("data-fullscreen", "overlay");
  await expect(map.getByRole("searchbox")).toBeVisible();
  await expect(map.getByRole("button", { name: "Увеличить", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(map).not.toHaveAttribute("data-fullscreen", "overlay");
  await expect(map.getByRole("button", { name: "На весь экран" })).toBeFocused();
});
