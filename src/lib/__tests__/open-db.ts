// Spawned by db.test.ts to open the database from a separate process.
import { getDb } from "../db";

try {
  getDb();
  process.stdout.write("ok");
} catch (error) {
  process.stdout.write(`fail: ${(error as Error).message}`);
  process.exitCode = 1;
}
