import "dotenv/config";
import { Pool } from "pg";
import { prisma } from "../lib/prisma.js";
import { getDatabasePoolConfig } from "../lib/database-config.js";

// Read-only: tidak menjalankan migration, seed, atau cleanup data.
const config = getDatabasePoolConfig();
const pool = new Pool({ ...config, max: 1 });
try {
  const database = await prisma.$queryRaw<{ database: string; role: string }[]>`
    SELECT current_database() AS database, current_user AS role
  `;
  const [users, recipes, ingredients, steps, sessions] = await Promise.all([
    prisma.user.count(), prisma.recipe.count(), prisma.recipeIngredient.count(),
    prisma.recipeStep.count(), pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM "session_store"."session"',
    ),
  ]);
  console.log(JSON.stringify({
    connected: true, database: database[0]?.database, role: database[0]?.role,
    tlsCertificateVerification: Boolean(config.ssl && typeof config.ssl === "object" && config.ssl.rejectUnauthorized),
    counts: { users, recipes, ingredients, steps, sessions: Number(sessions.rows[0]?.count) },
  }, null, 2));
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "CONNECTION_FAILED";
  console.error(`Database check failed (${code}). Check backend configuration and database permissions.`);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([prisma.$disconnect(), pool.end()]);
}
