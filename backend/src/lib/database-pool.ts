import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { getDatabasePoolConfig } from "./database-config.js";

/** Pool dibuat sekali per instance; Vercel menguras koneksi idle sebelum suspend. */
export function createDatabasePool(env: NodeJS.ProcessEnv = process.env): Pool {
  const pool = new Pool(getDatabasePoolConfig(env));
  pool.on("error", () => {
    // Error driver mentah dapat memuat detail koneksi; jangan log credential.
    console.error("Database pool connection error. Check database availability.");
  });
  if (env.VERCEL === "1") attachDatabasePool(pool);
  return pool;
}
