import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Televerse uses Render's built-in PostgreSQL when DATABASE_URL is set.
 *
 * If DATABASE_URL is missing OR malformed, return a Proxy that mimics
 * Drizzle's query interface but never touches the network. This keeps
 * the app bootable (build and runtime) with zero DB config.
 */
function looksLikePostgres(url: string): boolean {
  return /^postgres(ql)?:\/\/.+\/.+/.test(url);
}

function createDb() {
  const url = process.env.DATABASE_URL;
  const usable = url && looksLikePostgres(url);

  if (!usable) {
    return new Proxy(
      { _noop: true },
      {
        get(_, prop) {
          if (prop === "select" || prop === "insert" || prop === "update" || prop === "delete") {
            return () => ({
              from: () => ({
                where: () => ({
                  leftJoin: () => Promise.resolve([]),
                  execute: () => Promise.resolve([]),
                }),
                execute: () => Promise.resolve([]),
              }),
              values: () => ({
                returning: () => Promise.resolve([]),
                execute: () => Promise.resolve([]),
                onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }),
              }),
              set: () => ({
                where: () => ({
                  execute: () => Promise.resolve([]),
                  returning: () => Promise.resolve([]),
                }),
              }),
              execute: () => Promise.resolve([]),
            });
          }
          if (prop === "$client") return undefined;
          if (typeof prop === "string" && prop.startsWith("query")) {
            return {
              findMany: () => Promise.resolve([]),
              findFirst: () => Promise.resolve(undefined),
            };
          }
          return () => Promise.resolve([]);
        },
      },
    ) as unknown as ReturnType<typeof drizzle>;
  }

  // Real Postgres available — use Render's DATABASE_URL with the pg driver.
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  return drizzle(pool, { schema });
}

export const db = createDb();
