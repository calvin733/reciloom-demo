import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/http/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    // Unit/HTTP mock tests tidak pernah memakai konfigurasi database aplikasi.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://unit:unit@127.0.0.1:1/reciloom_unit_no_connection",
      SESSION_SECRET: "unit-test-secret-not-used-for-real-sessions",
      DOTENV_CONFIG_PATH: "tests/.env-disabled-for-tests",
      DOTENV_PATH: "tests/.env-disabled-for-tests",
    },
  },
});
