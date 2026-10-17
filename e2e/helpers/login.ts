import { expect, type Page } from "@playwright/test";
import { clearMailbox, waitForMagicLink } from "./mail";

/** Real magic-link login in the SAME browser context (PKCE verifier cookie must be present). */
export async function loginWithMagicLink(page: Page, email: string): Promise<void> {
  await clearMailbox(email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Отримати посилання" }).click();
  await expect(page.getByRole("status")).toContainText("Перевір пошту");
  const link = await waitForMagicLink(email);
  await page.goto(link);
}
