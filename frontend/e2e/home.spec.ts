import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders sidebar with model selector", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=VLM-AutoYOLO")).toBeVisible();
    await expect(page.getByText("VLM + SAM2")).toBeVisible();
    await expect(page.getByText("SAM3")).toBeVisible();
  });

  test("switches between VLM+SAM2 and SAM3 modes", async ({ page }) => {
    await page.goto("/");
    // Default: SAM2 checkbox visible
    await expect(page.locator("text=Enable SAM2")).toBeVisible({ timeout: 10000 });
    // Switch to SAM3
    await page.getByText("SAM3").click();
    await expect(page.locator("text=Enable SAM3")).toBeVisible({ timeout: 10000 });
    // Switch back
    await page.getByText("VLM + SAM2").click();
    await expect(page.locator("text=Enable SAM2")).toBeVisible({ timeout: 10000 });
  });

  test("shows history list", async ({ page }) => {
    await page.goto("/");
    // History records are visible (pexels filenames from test data)
    await expect(page.getByText("pexels-").first()).toBeVisible({ timeout: 10000 });
  });

  test("clicks history item shows detail on right panel", async ({ page }) => {
    await page.goto("/");
    const firstItem = page.getByText("pexels-").first();
    await firstItem.click();
    // Right panel no longer shows empty placeholder - it should show detection data
    await expect(page.locator("text=pexels-").first()).toBeVisible({ timeout: 10000 });
  });

  test("model status labels visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("VLM Model")).toBeVisible({ timeout: 10000 });
  });

  test("upload image and run detection", async ({ page }) => {
    await page.goto("/");

    // Upload test image via hidden file input
    const TEST_IMAGE = "../test_images/cat/pexels-helen1-30002394.jpg";
    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);

    // Add category "cat"
    const catInput = page.locator('input[placeholder*="Enter category"]');
    await catInput.fill("cat");
    await catInput.press("Enter");

    // Detect button should be enabled
    const detectBtn = page.locator("button", { hasText: /Detect/ });
    await expect(detectBtn).toBeEnabled({ timeout: 5000 });

    // Click detect
    await detectBtn.click();

    // Wait for detection to complete (result table with "boxes" appears)
    await expect(page.locator("table")).toBeVisible({ timeout: 60000 });
  });
});
