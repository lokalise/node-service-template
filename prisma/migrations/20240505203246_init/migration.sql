-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "post";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "user";

-- CreateTable
CREATE TABLE "post"."post" (
    "id" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "author_id" TEXT NOT NULL,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user"."profile" (
    "id" VARCHAR(32) NOT NULL,
    "bio" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user"."user" (
    "id" VARCHAR(32) NOT NULL,
    "age" INTEGER,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_author_id_idx" ON "post"."post"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_user_id_key" ON "user"."profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"."user"("email");
