import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  on: vi.fn(), attach: vi.fn(), config: vi.fn(() => ({ max: 3 })),
}));
vi.mock("pg", () => ({ Pool: class { on = mocks.on; } }));
vi.mock("@vercel/functions", () => ({ attachDatabasePool: mocks.attach }));
vi.mock("../../src/lib/database-config.js", () => ({ getDatabasePoolConfig: mocks.config }));
import { createDatabasePool } from "../../src/lib/database-pool.js";

describe("lifecycle pool pada hosting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mendaftarkan pool Vercel untuk menutup koneksi sebelum instance suspend", () => {
    const pool = createDatabasePool({ VERCEL: "1" });
    expect(mocks.attach).toHaveBeenCalledWith(pool);
  });

  it("koneksi lokal tidak memerlukan lifecycle Vercel", () => {
    createDatabasePool({});
    expect(mocks.attach).not.toHaveBeenCalled();
  });

  it("error koneksi idle ditangani tanpa membocorkan pesan driver", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    createDatabasePool({});
    const handler = mocks.on.mock.calls.find(([event]) => event === "error")?.[1];
    handler(new Error("postgresql://private-password@host/database"));
    expect(log).toHaveBeenCalledWith("Database pool connection error. Check database availability.");
    expect(log.mock.calls.flat().join(" ")).not.toContain("private-password");
  });
});
