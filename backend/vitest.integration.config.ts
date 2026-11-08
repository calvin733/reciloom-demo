import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/helpers/integration-setup.ts"],
    fileParallelism: false,
    hookTimeout: 20000,
    testTimeout: 15000,
  },
});
