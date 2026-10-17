import { expect, test } from "@playwright/test";
import { loginWithMagicLink } from "./helpers/login";

test("unauthenticated visit to / redirects to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Вхід" })).toBeVisible();
});

test("a user outside allowed_emails lands on /no-access and cannot read stores", async ({ page }) => {
  await loginWithMagicLink(page, "stranger@example.com");
  await expect(page).toHaveURL(/\/no-access$/);
  await expect(page.getByText("Тебе немає в списку доступу")).toBeVisible();

  // every other page is gated back to /no-access
  await page.goto("/");
  await expect(page).toHaveURL(/\/no-access$/);
  await page.goto("/stores");
  await expect(page).toHaveURL(/\/no-access$/);

  // RLS also blocks a direct REST read made with the stranger's own session token
  const cookies = await page.context().cookies();
  const parts = cookies.filter((c) => /auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  expect(parts.length).toBeGreaterThan(0);
  const joined = parts.map((c) => c.value).join("");
  const json = joined.startsWith("base64-")
    ? Buffer.from(joined.slice("base64-".length), "base64url").toString()
    : decodeURIComponent(joined);
  const accessToken = (JSON.parse(json) as { access_token: string }).access_token;
  const res = await page.request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/stores?select=id`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${accessToken}` },
  });
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual([]);
});
