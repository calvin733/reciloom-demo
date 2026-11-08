-- Jalankan MANUAL hanya pada database baru yang khusus dan boleh dibuang.
-- Marker ini sengaja TIDAK termasuk migration aplikasi.
CREATE SCHEMA IF NOT EXISTS "test_support";
CREATE TABLE IF NOT EXISTS "test_support"."environment" (
    "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
    "label" TEXT NOT NULL
);
INSERT INTO "test_support"."environment" ("id", "label")
VALUES (1, 'RECILOOM_DISPOSABLE_TEST_DATABASE')
ON CONFLICT ("id") DO NOTHING;
