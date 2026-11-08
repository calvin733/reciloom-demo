import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { requireTestDatabase } from "../tests/helpers/test-database.ts";

// Tidak memuat .env aplikasi dan tidak menjalankan migration/reset/seed otomatis.
const env = { ...process.env, NODE_ENV: "test" };
let target;
try {
  target = requireTestDatabase(env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const pool = new Pool({ connectionString: target, connectionTimeoutMillis: 3000 });
try {
  const result = await pool.query("SELECT label FROM test_support.environment WHERE id = 1");
  if (result.rows[0]?.label !== "RECILOOM_DISPOSABLE_TEST_DATABASE") {
    throw new Error("Missing disposable-test database marker.");
  }
} catch {
  console.error("Integration tests stopped: the disposable database is unreachable or its explicit test marker is missing. No fixtures were written.");
  process.exitCode = 1;
} finally {
  await pool.end();
}

if (!process.exitCode) {
  const backendRoot = fileURLToPath(new URL("../", import.meta.url));
  const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"], {
    cwd: backendRoot,
    stdio: "inherit",
    env: {
      ...env,
      DATABASE_URL: target,
      SESSION_SECRET: "integration-test-secret-for-disposable-database-only",
      DOTENV_CONFIG_PATH: "tests/.env-disabled-for-tests",
      DOTENV_PATH: "tests/.env-disabled-for-tests",
    },
  });
  process.exitCode = result.status ?? 1;
}
