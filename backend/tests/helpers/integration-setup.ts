import { Pool } from "pg";
import { requireTestDatabase } from "./test-database.js";

// Guard kedua melindungi pemanggilan Vitest secara langsung tanpa launcher.
const target = requireTestDatabase(process.env);
if (process.env.DATABASE_URL !== target ||
    process.env.DOTENV_CONFIG_PATH !== "tests/.env-disabled-for-tests" ||
    process.env.DOTENV_PATH !== "tests/.env-disabled-for-tests") {
  throw new Error("Use npm run test:integration so runtime configuration cannot fall back to the application .env.");
}

const pool = new Pool({ connectionString: target, connectionTimeoutMillis: 3000 });
try {
  const result = await pool.query("SELECT label FROM test_support.environment WHERE id = 1");
  if (result.rows[0]?.label !== "RECILOOM_DISPOSABLE_TEST_DATABASE") {
    throw new Error("Missing disposable-test database marker.");
  }
} finally {
  await pool.end();
}
