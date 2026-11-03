import { expect, test } from "@playwright/test";

import { DECIDED_REFUND } from "./fixtures";

test.describe("Detail page", () => {
  test("shows the overview and the audit timeline oldest first", async ({ page }) => {
    await page.goto(`/refunds/${DECIDED_REFUND.id}`);

    const overview = page.getByRole("region", { name: DECIDED_REFUND.id });
    await expect(overview).toContainText("Approved");
    await expect(overview).toContainText(DECIDED_REFUND.amount);
    await expect(page.getByRole("heading", { name: "Customer and Payment Details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Refund and Risk Details" })).toBeVisible();

    const timeline = page.getByRole("list").filter({ has: page.getByRole("heading", { level: 3 }) });
    const events = timeline.getByRole("listitem");
    await expect(page.getByText(/^\d+ events, oldest first$/)).toBeVisible();
    await expect(events.first().getByRole("heading", { level: 3 })).toHaveText("Refund requested");
    await expect(events.last().getByRole("heading", { level: 3 })).toHaveText("Approved");
    await expect(events.last()).toContainText("Latest");
  });

  test("an already-decided refund has no action panel", async ({ page }) => {
    await page.goto(`/refunds/${DECIDED_REFUND.id}`);

    await expect(page.getByRole("heading", { name: "Decision Information" })).toBeVisible();
    await expect(page.getByText("Reviewer", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/^Note/)).toHaveCount(0);
    for (const name of [/^Approve/, "Partially approve", "Reject", "Escalate"]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });

  test("an unknown refund ID shows the not-found page", async ({ page }) => {
    await page.goto("/refunds/rf_does_not_exist");

    await expect(page.getByRole("heading", { level: 1, name: "Refund not found" })).toBeVisible();
    await expect(page.getByText("There is no refund with this ID.")).toBeVisible();
    await page.getByRole("link", { name: "Return to Refunds" }).click();
    await expect(page).toHaveURL("/");
  });
});
