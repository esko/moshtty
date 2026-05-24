import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:8765";

test.describe("app shell", () => {
  test("serves index.html and renders settings page", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator("#settings")).toBeVisible();
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".brand")).toHaveText("Crostini Ghostty");
  });

  test("settings page shows project sidebar and sessions panel", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator(".landing-brand")).toBeVisible();
    await expect(page.locator(".space-list")).toBeVisible();
    await expect(page.locator("#searchSessionsInput")).toBeVisible();
    await expect(page.locator("#recentSessionsList")).toBeVisible();
  });

  test("settings form has expected sections", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator(".settings-form")).toBeVisible();
    await expect(page.locator("#fontSize")).toBeVisible();
    await expect(page.locator("#cursorStyle")).toBeVisible();
    await expect(page.locator("#cursorBlink")).toBeVisible();
  });

  test("command palette is hidden on page load", async ({ page }) => {
    await page.goto(BASE_URL);
    const palette = page.locator("#commandPalette");
    await expect(palette).not.toBeVisible();
  });
});

test.describe("health API", () => {
  test("GET /api/health returns ok", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
  });

  test("GET /api/session returns a token", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/session`);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(8);
  });
});
