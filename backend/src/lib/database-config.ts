import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolConfig } from "pg";

const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));

/** Konfigurasi bersama Prisma dan session store, tanpa mencetak credential. */
export function getDatabasePoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is missing.");
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  const max = Number(env.DATABASE_POOL_MAX ?? "3");
  if (!Number.isInteger(max) || max < 1 || max > 20) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20.");
  }
  const config: PoolConfig = { connectionString, max, connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: env.VERCEL === "1" ? 5_000 : 30_000, application_name: "reciloom" };
  if (!/(?:^|\.)supabase\.(?:co|com)$/.test(url.hostname)) return config;
  if (url.searchParams.get("sslmode") === "disable" || url.searchParams.get("sslaccept") === "accept_invalid_certs") {
    throw new Error("Supabase requires verified TLS; insecure SSL settings are not supported.");
  }
  const caFile = env.DATABASE_SSL_CA_FILE || url.searchParams.get("sslrootcert");
  let ca: string | undefined;
  if (caFile) {
    try { ca = readFileSync(resolve(backendDirectory, caFile), "utf8"); }
    catch { throw new Error("Cannot read DATABASE_SSL_CA_FILE. Check the certificate path."); }
  }
  // pg mengutamakan parameter SSL pada URL dibanding objek ssl. Bersihkan
  // parameter tersebut agar verifikasi sertifikat selalu aktif di kedua pool.
  for (const key of ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey", "sslpassword", "sslaccept", "uselibpqcompat"]) {
    url.searchParams.delete(key);
  }
  config.connectionString = url.toString();
  config.ssl = { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  return config;
}
