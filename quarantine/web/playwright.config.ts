import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 15000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8765",
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: "go run . -web-dir ../web/dist",
    cwd: "../agent",
    url: "http://127.0.0.1:8765/api/health",
    timeout: 15000,
    reuseExistingServer: true,
  },
});
