import { expect, test } from "@playwright/test";

test("requester uses the single prototype request form", async ({ page }) => {
  await page.goto("/prototype");
  await page.evaluate(() => localStorage.setItem("iap-active-profile", "alex-requester"));
  await page.reload();
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await expect(page.getByRole("heading", { name: "REQUEST FOR PAYMENT FORM" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NATURE OF PAYMENT" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Supporting Documents" })).toBeVisible();
});

test("legacy application routes redirect to the prototype", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/prototype$/);
});
