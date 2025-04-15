CREATE TYPE "user"."user_role" AS ENUM('Admin', 'Writer', 'Reader');--> statement-breakpoint
ALTER TABLE "user"."user" ADD COLUMN "role" "user"."user_role" NOT NULL;