import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Supabase env comes from the process env or .env.local (see scripts/e2e-env.sh).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const BASE = "http://127.0.0.1:3000"; // exactly what supabase/config.toml allow-lists

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL: BASE, locale: "uk-UA", timezoneId: "Europe/Kyiv" },
  // Production build: what ships to Vercel, and no dev-overlay/HMR flakiness.
  webServer: {
    command: "npm run build && npm run start -- -H 127.0.0.1",
    url: `${BASE}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: process.env as Record<string, string>,
  },
});
