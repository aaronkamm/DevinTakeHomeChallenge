/**
 * Builds a fresh database for the e2e run: wipes DATABASE_DIR, runs the migrations and
 * `npm run db:seed`, then adds the extra refunds the specs need. Playwright's webServer runs this
 * right before `next dev`, so the server never sees a half-seeded database.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createDb } from "../src/lib/db";
import { INTAKE } from "../src/lib/reviewers";
import { auditEvents, refunds } from "../src/lib/schema";

import { OVER_LIMIT_REFUND } from "./fixtures";

const HOUR_MS = 60 * 60 * 1000;

async function main() {
  const dir = process.env.DATABASE_DIR;
  // This deletes the directory, so refuse to touch the default dev database.
  if (!dir || path.resolve(dir) === path.resolve("data", "pglite")) {
    throw new Error("Set DATABASE_DIR to a dedicated e2e directory (see playwright.config.ts).");
  }
  fs.rmSync(dir, { recursive: true, force: true });

  // The seed applies the migrations on first access, then inserts the sample data.
  execSync("npm run db:seed", { stdio: "inherit", env: process.env });

  const db = await createDb(dir);
  try {
    const createdAt = new Date(Date.now() - HOUR_MS);
    await db.insert(refunds).values({
      id: OVER_LIMIT_REFUND.id,
      customerName: OVER_LIMIT_REFUND.customerName,
      customerEmail: "avery.brooks@example.com",
      transactionId: "txn_e2e_0001",
      accountId: "acct_e2e_0001",
      paymentMethod: "card",
      merchantName: "Delta Air Lines",
      originalAmountCents: OVER_LIMIT_REFUND.amountCents * 2,
      requestedAmountCents: OVER_LIMIT_REFUND.amountCents,
      currency: "USD",
      reason: "Duplicate charge on card",
      status: "pending",
      riskScore: 25,
      createdAt,
      updatedAt: createdAt,
    });
    await db.insert(auditEvents).values({
      refundId: OVER_LIMIT_REFUND.id,
      action: "created",
      actor: INTAKE,
      actorRole: "system",
      fromStatus: null,
      toStatus: "pending",
      amountCents: OVER_LIMIT_REFUND.amountCents,
      note: "Duplicate charge on card",
      createdAt,
    });
    console.log(`Added e2e fixture refund ${OVER_LIMIT_REFUND.id}.`);
  } finally {
    await db.$client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
