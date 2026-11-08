
import "dotenv/config";

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createDatabasePool } from "./database-pool.js";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET is missing or too short.");
}

export const sessionPool = createDatabasePool();

const PgSessionStore = connectPgSimple(session);

export const sessionStore = new PgSessionStore({
  pool: sessionPool,
  schemaName: "session_store",
  tableName: "session",
  // Schema disiapkan oleh migration, bukan oleh request atau cold start.
  createTableIfMissing: false,
});

export const sessionMiddleware = session({
  name: "reciloom.sid",
  secret: sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
});
