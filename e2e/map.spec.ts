import { expect, test } from "@playwright/test";
import { loginWithMagicLink } from "./helpers/login";

test("pick a store's place by clicking the map, see it on the store page and when editing", async ({ page }) => {
  const name = `Тест Карта ${Date.now()}`;
  await loginWithMagicLink(page, "test@example.com");
  await expect(page).toHaveURL("/");

  await page.goto("/stores/new");
  await page.getByLabel("Назва *").fill(name);
  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible();
  await expect(page.getByText("Місце вибрано")).toHaveCount(0);
  await map.click({ position: { x: 150, y: 110 } });
  await expect(page.getByText("Місце вибрано")).toBeVisible();
  await page.getByRole("button", { name: "Зберегти" }).click();

  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]{36}$/);
  const storeUrl = page.url();
  try {
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.getByRole("link", { name: "Відкрити в картах" })).toHaveAttribute(
      "href",
      /query=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
    );

    // the place is prefilled when editing, and can be removed
    await page.goto(`${storeUrl}/edit`);
    await expect(page.getByText("Місце вибрано")).toBeVisible();
    await page.getByRole("button", { name: "Прибрати" }).click();
    await expect(page.getByText("Місце вибрано")).toHaveCount(0);
    await page.getByRole("button", { name: "Зберегти" }).click();
    await expect(page).toHaveURL(storeUrl);
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  } finally {
    await page.goto(`${storeUrl}/edit`);
    await page.getByRole("button", { name: "Видалити магазин" }).click();
    await page.getByRole("button", { name: "Точно видалити?" }).click();
    await expect(page).toHaveURL(/\/stores$/);
  }
});
