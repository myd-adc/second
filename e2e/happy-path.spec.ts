import { expect, test } from "@playwright/test";
import { loginWithMagicLink } from "./helpers/login";

const WEDNESDAY = 2; // 0 = Monday

/** Nearest Wednesday on/after today, computed in Kyiv time (UTC-midnight arithmetic, DST-safe). */
function nearestWednesdayKyiv(now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(now); // YYYY-MM-DD
  const d = new Date(`${today}T00:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() + ((WEDNESDAY - weekday + 7) % 7));
  return d.toISOString().slice(0, 10);
}

test("log in, create a store, mark a delivery twice, see it on the home page", async ({ page }) => {
  const name = `Тест Секонд ${Date.now()}`;
  await loginWithMagicLink(page, "test@example.com");
  await expect(page).toHaveURL("/");

  await page.goto("/stores/new");
  await page.getByLabel("Назва *").fill(name);
  await page.getByRole("button", { name: "+ Додати правило" }).click();
  await page.getByLabel("Тип").selectOption("every_n_weeks");
  await page.getByLabel("Раз на скільки тижнів (2–8)").fill("2");
  await page.getByLabel("Опорна дата завозу").fill(nearestWednesdayKyiv());
  await expect(page.getByText("день тижня: ср")).toBeVisible();
  await page.getByRole("button", { name: "Зберегти" }).click();

  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]{36}$/);
  const storeUrl = page.url();
  try {
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("кожні 2 тижні")).toBeVisible();

    const mark = page.getByRole("button", { name: "Завіз був" });
    await mark.click();
    await expect(page.getByRole("status")).toHaveText("Збережено");

    // second tap, same day: updates the entry instead of failing on the unique constraint
    await page.reload();
    await page.getByRole("button", { name: "Завіз був" }).click();
    await expect(page.getByRole("status")).toHaveText("Збережено");
    await expect(page.locator(".mark-error")).toHaveCount(0);
    await page.reload();
    const entries = page.locator("ul.journal li");
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText("(ти)");
    await expect(entries.first()).toContainText("завіз був");

    await page.goto("/");
    await expect(page.getByText(name)).toBeVisible();
  } finally {
    // clean up through the UI so the suite is re-runnable against the same DB
    await page.goto(`${storeUrl}/edit`);
    await page.getByRole("button", { name: "Видалити магазин" }).click();
    await page.getByRole("button", { name: "Точно видалити?" }).click();
    await expect(page).toHaveURL(/\/stores$/);
  }
});
