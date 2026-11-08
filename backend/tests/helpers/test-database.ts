// Dipakai launcher dan integration setup sebelum mengimpor app/Prisma.
export function requireTestDatabase(env: NodeJS.ProcessEnv): string {
  if (env.NODE_ENV !== "test" || env.RECILOOM_TEST_DB_CONFIRMED !== "1") {
    throw new Error("Integration tests require NODE_ENV=test and RECILOOM_TEST_DB_CONFIRMED=1.");
  }

  let url: URL;
  try {
    url = new URL(env.TEST_DATABASE_URL ?? "");
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid disposable PostgreSQL URL.");
  }

  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  const validDatabase = /^\/reciloom_test(?:_[a-z0-9_]+)?$/.test(url.pathname);
  const safeParameters = [...url.searchParams].every(([key, value]) => key === "schema" && value === "public");

  if (!["postgresql:", "postgres:"].includes(url.protocol) ||
      !localHosts.includes(url.hostname) || !url.port ||
      !validDatabase || !safeParameters || url.hash) {
    throw new Error("Tests require a local PostgreSQL URL with an explicit port, database reciloom_test[_suffix], and no connection overrides.");
  }

  return url.toString();
}
