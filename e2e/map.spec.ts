import { expect, test } from "@playwright/test";
import { loginWithMagicLink } from "./helpers/login";

// local GoTrue allows one email per address per second (max_frequency in supabase/config.toml)
test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(1500);
});

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

test.describe("stores map tab", () => {
  test.use({ geolocation: { latitude: 50.4501, longitude: 30.5234 }, permissions: ["geolocation"] });

  test("shows a marker with a popup, switches tabs, and shows where I am", async ({ page }) => {
    const name = `Тест Мітка ${Date.now()}`;
    await loginWithMagicLink(page, "test@example.com");
    await expect(page).toHaveURL("/");

    await page.goto("/stores/new");
    await page.getByLabel("Назва *").fill(name);
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await page.locator(".leaflet-container").click({ position: { x: 150, y: 110 } });
    await expect(page.getByText("Місце вибрано")).toBeVisible();
    await page.getByRole("button", { name: "Зберегти" }).click();
    await expect(page).toHaveURL(/\/stores\/[0-9a-f-]{36}$/);
    const storeUrl = page.url();
    try {
      await page.goto("/");
      await page.getByRole("link", { name: "Карта" }).click();
      await expect(page).toHaveURL(/\?view=map$/);
      await expect(page.getByTestId("stores-map")).toBeVisible();

      // the new store is a marker; tapping it opens a card with the name, status and a link
      const marker = page.locator(`.leaflet-marker-icon[title="${name}"]`);
      await expect(marker).toBeVisible();
      await marker.click();
      const popup = page.locator(".map-popup");
      await expect(popup).toContainText(name);
      await expect(popup).toContainText(/відкрито до|зараз зачинено/);
      await expect(popup.getByRole("link", { name: "Відкрити магазин" })).toHaveAttribute("href", storeUrl.replace(/^https?:\/\/[^/]+/, ""));

      // permission already granted: the blue «I am here» dot appears without a tap
      await expect(page.locator("path.leaflet-interactive")).toHaveCount(1);

      // back to the list tab
      await page.getByRole("link", { name: "Список" }).click();
      await expect(page).toHaveURL(/\?view=list$/);
      await expect(page.getByText(name)).toBeVisible();
    } finally {
      await page.goto(`${storeUrl}/edit`);
      await page.getByRole("button", { name: "Видалити магазин" }).click();
      await page.getByRole("button", { name: "Точно видалити?" }).click();
      await expect(page).toHaveURL(/\/stores$/);
    }
  });
});
