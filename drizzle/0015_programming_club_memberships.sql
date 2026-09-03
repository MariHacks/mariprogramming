CREATE TABLE "mt_programming_club_memberships" (
	"user_id" text PRIMARY KEY NOT NULL,
	"program" varchar(160) NOT NULL,
	"graduation_year" integer NOT NULL,
	"experience_level" varchar(16) NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"staff_visibility_accepted_at" timestamp with time zone NOT NULL,
	"schedule_shared_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_programming_club_memberships_graduation_year_valid" CHECK ("graduation_year" >= 2026 AND "graduation_year" <= 2040),
	CONSTRAINT "mt_programming_club_memberships_experience_level_valid" CHECK ("experience_level" IN ('new', 'learning', 'comfortable', 'advanced')),
	CONSTRAINT "mt_programming_club_memberships_interests_array" CHECK (jsonb_typeof("interests") = 'array'),
	CONSTRAINT "mt_programming_club_memberships_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" ADD CONSTRAINT "mt_programming_club_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "mt_programming_club_memberships_schedule_shared_idx" ON "mt_programming_club_memberships" ("schedule_shared_at");
