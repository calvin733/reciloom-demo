-- Session memakai schema terpisah dari model domain Prisma.
-- IF NOT EXISTS mempertahankan tabel session yang mungkin sudah disiapkan lokal.
CREATE SCHEMA IF NOT EXISTS "session_store";

CREATE TABLE IF NOT EXISTS "session_store"."session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire"
    ON "session_store"."session" ("expire");
