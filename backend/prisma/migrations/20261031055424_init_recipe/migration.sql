-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);
