import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function capture(page: Page, filename: string) {
  const directory = process.env.ATLAS_SMART_SCREENSHOTS;
  if (directory) await page.screenshot({ path: path.join(directory, filename + ".jpg"), quality: 87 });
}

const fieldName = "Поиск по базе знаний";
const questionName = "Вопрос об Олимпийских играх";
const typo = "На каких олимпидах выступала Симона Байлс?";
const correctedQuestion = "На каких олимпиадах выступала Симона Байлз?";

async function openSearch(page: Page) {
  await page.goto("/explore");
  await page.getByRole("button", { name: "Поиск по базе" }).click();
  return page.getByRole("combobox", { name: fieldName });
}

test("SMART SEARCH shows suggestions and selects the correct profile by keyboard", async ({ page }) => {
  const input = await openSearch(page);
  const list = page.getByRole("listbox", { name: "Подсказки поиска" });
  await input.fill("усеин бол");
  await expect(list.getByRole("option").first()).toContainText("Усэйн Болт");
  await expect(input).toHaveAttribute("aria-expanded", "true");

  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", "atlas-option-0");
  await expect(list.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await capture(page, "02-suggestions");
  await input.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("усеин бол");

  await input.press("ArrowUp");
  await expect(list).toBeVisible();
  await input.press("Tab");
  await expect(list).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Очистить запрос" })).toBeFocused();

  await input.focus();
  await expect(list).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/athletes\/usain-bolt$/);
  await expect(page.getByRole("heading", { name: "Усэйн Болт", exact: true })).toBeVisible();
});

test("SMART SEARCH shows and reverses a correction for the submitted query", async ({ page }) => {
  const input = await openSearch(page);
  await input.fill("Майкл Фелс");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Возможно, вы имели в виду" })).toBeVisible();
  await expect(input).toHaveValue("Майкл Фелс");
  await capture(page, "01-typo");

  await page.getByRole("region", { name: "Исправления запроса" }).getByRole("button", { name: "Майкл Фелпс", exact: true }).click();
  await expect(input).toHaveValue("Майкл Фелпс");
  await expect(page.getByText(/Запрос «Майкл Фелпс»/)).toBeVisible();
  await expect(page.locator('main a[href="/athletes/michael-phelps"]')).toBeVisible();
  await capture(page, "03-corrected");

  await page.getByRole("button", { name: "Вернуться к исходному запросу" }).click();
  await expect(input).toHaveValue("Майкл Фелс");
  await expect(page.getByRole("region", { name: "Исправления запроса" }).getByRole("button", { name: "Майкл Фелпс", exact: true })).toBeVisible();
});

test("SMART SEARCH requires confirmation before showing sourced facts", async ({ page }) => {
  await page.goto("/explore");
  const input = page.getByRole("combobox", { name: questionName });
  await input.fill(typo);
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByRole("button", { name: correctedQuestion })).toBeVisible();
  await expect(page.getByText("Как получен ответ?")).toHaveCount(0);
  await page.getByRole("button", { name: correctedQuestion }).click();
  await expect(input).toHaveValue(correctedQuestion);
  await expect(page.getByText("Рио-де-Жанейро 2016", { exact: true })).toBeVisible();
  await page.getByText("Как получен ответ?").click();
  await expect(page.getByRole("heading", { name: "Исходные факты и источники" })).toBeVisible();
  await expect(page.locator('main details a[target="_blank"]').first()).toBeAttached();
  await page.locator("#atlas-answer").scrollIntoViewIfNeeded();
  await capture(page, "04-question");
});

test("SMART SEARCH rejects stale suggestions after deletion or mode changes and survives network failure", async ({ page }) => {
  const input = await openSearch(page);
  const list = page.getByRole("listbox", { name: "Подсказки поиска" });
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/explore/suggestions?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") === "усеин бол") await blocked;
    await route.continue();
  });
  const started = page.waitForRequest((request) => request.url().includes("/api/explore/suggestions?"));
  await input.fill("усеин бол");
  await started;
  await input.fill("");
  release();
  await input.fill("Б");
  await expect(list).toHaveCount(0);
  await input.fill("Майкл Фел");
  await expect(list.getByRole("option").first()).toContainText("Майкл Фелпс");
  await page.getByRole("button", { name: "Вопрос", exact: true }).click();
  await expect(list).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: questionName })).toHaveValue("Майкл Фел");

  await page.unroute("**/api/explore/suggestions?*");
  await page.route("**/api/explore/suggestions?*", (route) => route.abort());
  await page.getByRole("button", { name: "Поиск по базе" }).click();
  const failed = page.waitForEvent("requestfailed", (request) => request.url().includes("/api/explore/suggestions?"));
  await input.fill("Майкл Фелс");
  await failed;
  await expect(list).toHaveCount(0);
  await page.route("**/api/explore", (route) => route.abort(), { times: 1 });
  await input.press("Enter");
  await expect(page.locator("main").getByRole("alert")).toContainText("Не удалось связаться");
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByRole("region", { name: "Исправления запроса" }).getByRole("button", { name: "Майкл Фелпс", exact: true })).toBeVisible();
});

test.describe("mobile SMART SEARCH", () => {
  test.use({ viewport: { width: 375, height: 900 }, hasTouch: true, isMobile: true });

  test("SMART SEARCH dropdown fits 375px and supports touch selection", async ({ page }) => {
    const input = await openSearch(page);
    await input.fill("Париж 20244");
    const list = page.getByRole("listbox", { name: "Подсказки поиска" });
    const option = list.getByRole("option").first();
    await expect(option).toContainText("Париж 2024");
    const bounds = await list.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
    await expect(page.getByRole("button", { name: "Найти", exact: true })).toBeVisible();
    await capture(page, "05-mobile");
    await option.tap();
    await expect(page).toHaveURL(/\/games\/paris-2024$/);
  });
});

test("SMART SEARCH centers the graph on a corrected edition", async ({ page }) => {
  await page.goto("/knowledge-graph?mode=explore");
  await page.getByRole("searchbox", { name: "Поиск по графу" }).fill("Париж 20244");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: /Париж 2024/ }).first().click();
  const inspector = page.getByRole("complementary", { name: "Инспектор графа" });
  await expect(inspector.getByRole("heading", { name: "Париж 2024" })).toBeVisible();
  await expect(inspector.getByRole("link", { name: "Страница объекта" })).toHaveAttribute("href", "/games/paris-2024");
});
