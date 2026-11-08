import { describe, expect, it, vi } from "vitest";
vi.mock("node:fs", () => ({ readFileSync: vi.fn(() => "TEST-CA-CERTIFICATE") }));
import { getDatabasePoolConfig } from "../../src/lib/database-config.js";

const cloud = "postgresql://reciloom_backend.project:test-only-password@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?schema=public&sslmode=verify-full";
describe("konfigurasi koneksi database", () => {
  it("mempertahankan koneksi lokal tanpa memaksa SSL", () => {
    const config = getDatabasePoolConfig({ DATABASE_URL: "postgresql://local:local@127.0.0.1:5432/reciloom_dev" });
    expect(config.ssl).toBeUndefined(); expect(config.max).toBe(3);
  });
  it("memverifikasi TLS Supabase dan mencegah override ssl dari query URL", () => {
    const config = getDatabasePoolConfig({ DATABASE_URL: cloud });
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(new URL(config.connectionString!).searchParams.has("sslmode")).toBe(false);
    expect(new URL(config.connectionString!).searchParams.get("schema")).toBe("public");
  });
  it("mendukung CA eksplisit tanpa mematikan verifikasi", () => {
    expect(getDatabasePoolConfig({ DATABASE_URL: cloud, DATABASE_SSL_CA_FILE: "certs/test-ca.crt" }).ssl)
      .toEqual({ rejectUnauthorized: true, ca: "TEST-CA-CERTIFICATE" });
  });
  it.each(["0", "abc", "21"])("menolak batas pool tidak valid: %s", value => {
    expect(() => getDatabasePoolConfig({ DATABASE_URL: cloud, DATABASE_POOL_MAX: value })).toThrow("DATABASE_POOL_MAX");
  });
  it("mendukung transaction pooler untuk runtime Vercel dengan TLS tetap diverifikasi", () => {
    const config = getDatabasePoolConfig({ DATABASE_URL: cloud.replace(":5432/", ":6543/"), VERCEL: "1" });
    expect(new URL(config.connectionString!).port).toBe("6543");
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.idleTimeoutMillis).toBe(5_000);
  });
  it("menolak pengaturan yang menonaktifkan TLS Supabase", () => {
    expect(() => getDatabasePoolConfig({ DATABASE_URL: cloud.replace("verify-full", "disable") })).toThrow("verified TLS");
  });
  it.each([undefined, "https://example.test/test-only-password"])("error konfigurasi tidak membocorkan credential", value => {
    expect(() => getDatabasePoolConfig({ DATABASE_URL: value })).toThrow();
    try { getDatabasePoolConfig({ DATABASE_URL: value }); } catch (error) { expect(String(error)).not.toContain("test-only-password"); }
  });
});
