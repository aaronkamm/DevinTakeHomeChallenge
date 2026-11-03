import { expect, test } from "@playwright/test";

import { TOTAL_REFUND_COUNT } from "./fixtures";

const refundLinks = (page: import("@playwright/test").Page) =>
  page.getByRole("table").getByRole("link", { name: /^rf_/ });

test.describe("Browse page", () => {
  test("lists the seeded refunds", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Refunds" })).toBeVisible();
    await expect(page.getByText(`Showing 1–20 of ${TOTAL_REFUND_COUNT} refunds`)).toBeVisible();
    await expect(refundLinks(page)).toHaveCount(20);
    await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("Page 1 of 2");
  });

  test("status filter narrows the results", async ({ page }) => {
    await page.goto("/");
    await expect(refundLinks(page)).toHaveCount(20);

    const filter = page.getByRole("navigation", { name: "Filter by status" });
    await filter.getByRole("link", { name: "Rejected", exact: true }).click();

    await expect(page).toHaveURL(/\?status=rejected$/);
    await expect(filter.getByRole("link", { name: "Rejected", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Nothing in the e2e run rejects a refund, so the five seeded rejections are stable.
    await expect(page.getByText("Showing 1–5 of 5 refunds")).toBeVisible();
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(5);
    for (const row of await rows.all()) {
      await expect(row.getByRole("cell").nth(4)).toHaveText("Rejected");
    }

    await filter.getByRole("link", { name: "All", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(`of ${TOTAL_REFUND_COUNT} refunds`)).toBeVisible();
  });

  test("clicking a refund opens its detail page", async ({ page }) => {
    await page.goto("/");

    const firstLink = refundLinks(page).first();
    const id = (await firstLink.textContent())!.trim();
    await firstLink.click();

    await expect(page).toHaveURL(`/refunds/${id}`);
    await expect(page.getByRole("heading", { level: 2, name: id })).toBeVisible();
  });
});
