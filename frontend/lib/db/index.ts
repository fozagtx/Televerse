import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Return a Proxy that mimics Drizzle's query interface.
    // Auth.js Drizzle adapter calls methods on this at build time; the
    // Proxy returns empty results so the build succeeds without a database.
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
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export const db = createDb();