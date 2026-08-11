import "dotenv/config";
import { pool, runMigrations } from "@visit-control/db";
import { seedAdminUser } from "./lib/seed";

try {
  await runMigrations();
  await seedAdminUser();
} finally {
  await pool.end();
}
