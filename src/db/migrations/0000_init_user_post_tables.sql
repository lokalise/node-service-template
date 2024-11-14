CREATE SCHEMA "post";
--> statement-breakpoint
CREATE SCHEMA "user";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post"."post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"title" varchar(256) NOT NULL,
	"content" varchar,
	"published" boolean DEFAULT false,
	"author_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user"."profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bio" varchar,
	"age" integer,
	"email" varchar NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "profile_email_unique" UNIQUE("email"),
	CONSTRAINT "profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"age" integer,
	"email" varchar NOT NULL,
	"name" varchar NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "author_id_idx" ON "post"."post" USING btree ("author_id");