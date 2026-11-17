import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173', viewport: { width: 400, height: 860 }, acceptDownloads: true },
  reporter: 'list',
})
