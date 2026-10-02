import { expect, test } from "@playwright/test";

test("administrator can configure request master data", async ({ page }) => {
  await page.goto("/prototype");
  await page.evaluate(() => {
    localStorage.setItem("iap-active-profile", "avery-admin");
    localStorage.removeItem("iap-master-data");
  });
  await page.reload();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Master Data Settings" })).toBeVisible();
  await expect(page.locator(".master-card")).toHaveCount(3);

  await page.getByPlaceholder("Add project code").fill("TEST-PROJECT");
  await page.getByPlaceholder("Add project code").press("Enter");
  await expect(page.getByText("TEST-PROJECT", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await expect(page.locator('select option[value="TEST-PROJECT"]')).toHaveCount(1);
});

test("settings are hidden from non-administrator profiles", async ({ page }) => {
  await page.goto("/prototype");
  await page.evaluate(() => localStorage.setItem("iap-active-profile", "alex-requester"));
  await page.reload();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
});
