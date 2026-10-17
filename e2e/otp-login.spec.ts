import { expect, test } from "@playwright/test";
import { clearMailbox, waitForOtpCode } from "./helpers/mail";

// local GoTrue allows one mail per address per second (max_frequency); the previous spec/test just requested one
test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(1_500);
});

// The magic link only works in the browser that requested it (PKCE); the emailed code works anywhere.
test("log in with the 6-digit code from the email instead of the link", async ({ page }) => {
  const email = "test@example.com";
  await clearMailbox(email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Отримати посилання" }).click();
  await expect(page.getByRole("status")).toContainText("Перевір пошту");

  const code = await waitForOtpCode(email);
  await page.getByLabel("Або введи код з листа").fill(code);
  await page.getByRole("button", { name: "Увійти з кодом" }).click();
  await expect(page).toHaveURL("/");
});

test("a wrong code shows a generic error and stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByRole("button", { name: "Отримати посилання" }).click();
  await expect(page.getByRole("status")).toContainText("Перевір пошту");
  await page.getByLabel("Або введи код з листа").fill("000000");
  await page.getByRole("button", { name: "Увійти з кодом" }).click();
  await expect(page.getByText("Невірний або прострочений код").and(page.getByRole("alert"))).toHaveText("Невірний або прострочений код. Спробуй ще раз.");
  await expect(page).toHaveURL(/\/login$/);
});
