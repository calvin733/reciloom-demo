
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { createDatabasePool } from "./database-pool.js";

// Tanpa statementNameGenerator: adapter-pg memakai statement tanpa nama,
// sesuai dengan Supabase Transaction pooler. Disconnect juga menutup pool ini.
const adapter = new PrismaPg(createDatabasePool(), { disposeExternalPool: true });

export const prisma = new PrismaClient({
  adapter,
});
