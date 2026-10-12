// playwright.config.js — Step AT item 4: live, READ-ONLY smoke tests.
//
// These run against the DEPLOYED site (https://glazepro.vercel.app by
// default, override with E2E_BASE_URL) using a real login. They must never
// create, change or save anything: they open pages and read them. The only
// write any of them could cause is Supabase's own session row from logging
// in.
//
// Credentials come from a local `.env.e2e`, which is git-ignored and which
// Nathan fills himself. They are never printed: on a missing file the tests
// fail with the variable NAMES only.
//
// Run:  npx playwright install chromium   (once)
//       npm run e2e

import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'

// A deliberately small .env reader — no dotenv dependency for one file, and
// it never logs a value.
const ENV_FILE = '.env.e2e'
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const text = line.trim()
    if (!text || text.startsWith('#')) continue
    const eq = text.indexOf('=')
    if (eq < 0) continue
    const key = text.slice(0, eq).trim()
    let value = text.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

export default defineConfig({
  testDir: 'e2e',
  // One worker: a single shared login against the live site, and no reason
  // to put concurrent load on it.
  workers: 1,
  fullyParallel: false,
  // The live site is pricing 23 benchmarks in the browser on one of these
  // pages, so the timeouts are generous rather than flaky.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://glazepro.vercel.app',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
