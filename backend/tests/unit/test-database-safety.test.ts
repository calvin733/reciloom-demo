import { describe, expect, it } from "vitest";
import { requireTestDatabase } from "../helpers/test-database.js";

const testEnv = {
  NODE_ENV: "test",
  RECILOOM_TEST_DB_CONFIRMED: "1",
  TEST_DATABASE_URL: "postgresql://test:test@127.0.0.1:55432/reciloom_test_phase1?schema=public",
};

describe("Guard database integration", () => {
  it("menerima target lokal bernama khusus test dengan opt-in eksplisit", () => {
    expect(requireTestDatabase(testEnv)).toBe(testEnv.TEST_DATABASE_URL);
  });
  it.each(["development", "production", undefined])("menolak NODE_ENV=%s", (NODE_ENV) => {
    expect(() => requireTestDatabase({ ...testEnv, NODE_ENV })).toThrow();
  });
  it("menolak test tanpa konfirmasi", () => {
    expect(() => requireTestDatabase({ ...testEnv, RECILOOM_TEST_DB_CONFIRMED: undefined })).toThrow();
  });
  it.each([
    "postgresql://test:test@127.0.0.1:5432/reciloom_dev",
    "postgresql://test:test@db.example.com:5432/reciloom_test",
    "postgresql://test:test@localhost/reciloom_test",
    "postgresql://test:test@localhost:55432/reciloom_test?host=db.example.com",
    "postgresql://test:test@localhost:55432/reciloom_test?schema=private",
    "https://localhost:55432/reciloom_test",
  ])("menolak target yang tidak aman: %s", (TEST_DATABASE_URL) => {
    expect(() => requireTestDatabase({ ...testEnv, TEST_DATABASE_URL })).toThrow();
  });
  it("tidak membocorkan URL/credential ketika parsing gagal", () => {
    expect(() => requireTestDatabase({ ...testEnv, TEST_DATABASE_URL: "not-a-url-with-private-password" })).toThrow("TEST_DATABASE_URL must be a valid disposable PostgreSQL URL.");
  });
});
