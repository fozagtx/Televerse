import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Lazy database client.
 *
 * The app is fully in-memory (no auth, no persistence required), so the
 * database is optional. If DATABASE_URL is missing, we create a client that
 * throws only if something actually tries to query it — it never blocks
 * server startup.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const lazy = {
      async select() {
        throw new Error("DATABASE_URL not set. Televerse runs in-memory without a database.");
      },
    } as never;
    return lazy as unknown as ReturnType<typeof drizzle>;
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export const db = createDb();
