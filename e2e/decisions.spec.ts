import { expect, test, type Page } from "@playwright/test";

import { AGENT_DECIDABLE_REFUND, OVER_LIMIT_REFUND } from "./fixtures";

function timelineEvents(page: Page) {
  return page
    .getByRole("list")
    .filter({ has: page.getByRole("heading", { level: 3 }) })
    .getByRole("listitem");
}

test.describe("Decision workflow", () => {
  test("an agent approves a refund and the change shows everywhere", async ({ page }) => {
    const { id, amount } = AGENT_DECIDABLE_REFUND;
    const note = "Fee waived per overdraft courtesy policy (e2e)";

    await page.goto(`/refunds/${id}`);
    const overview = page.getByRole("region", { name: id });
    await expect(overview).toContainText("Pending");
    const events = timelineEvents(page);
    const eventsBefore = await events.count();

    await page.getByLabel(/^Note/).fill(note);
    await page.getByRole("button", { name: `Approve ${amount}` }).click();

    // Detail page: status, decision card and a new audit entry.
    await expect(overview).toContainText("Approved");
    await expect(page.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
    await expect(page.getByText(note, { exact: true }).first()).toBeVisible();
    await expect(events).toHaveCount(eventsBefore + 1);
    const latest = events.last();
    await expect(latest.getByRole("heading", { level: 3 })).toHaveText("Approved");
    await expect(latest).toContainText("Latest");
    await expect(latest).toContainText("Maya Chen");
    await expect(latest).toContainText(note);

    // Browse page: the row moved from Pending to Approved.
    await page.goto("/?status=approved");
    const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: id }) });
    await expect(row.getByRole("cell").nth(4)).toHaveText("Approved");
    await page.goto("/?status=pending");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("link", { name: id })).toHaveCount(0);
  });

  test("an agent can't approve over $500 until switching to a manager", async ({ page }) => {
    const { id, amount } = OVER_LIMIT_REFUND;
    await page.goto(`/refunds/${id}`);

    // Default actor is an agent: no decision buttons, only escalation.
    await expect(page.getByText("Acting as Maya Chen · Agent")).toBeVisible();
    await expect(
      page.getByText("Only a manager can decide this refund. Amount is above the agent approval limit."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Escalate" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Approve/ })).toHaveCount(0);

    await page.getByLabel("Acting as").selectOption({ label: "Sam Okafor · Manager" });

    await expect(page.getByText("Acting as Sam Okafor · Manager")).toBeVisible();
    const approve = page.getByRole("button", { name: `Approve ${amount}` });
    await expect(approve).toBeEnabled();
    await approve.click();

    await expect(page.getByRole("region", { name: id })).toContainText("Approved");
    const latest = timelineEvents(page).last();
    await expect(latest.getByRole("heading", { level: 3 })).toHaveText("Approved");
    await expect(latest).toContainText("Sam Okafor");
    await expect(latest).toContainText("Manager");
  });
});
