import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { db } from "./index";

export async function runMigrations() {
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
}
