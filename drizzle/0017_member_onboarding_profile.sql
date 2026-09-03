ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "username" varchar(32);
--> statement-breakpoint
ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "first_name" varchar(80);
--> statement-breakpoint
ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "last_name" varchar(80);
--> statement-breakpoint
ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "profile_image_data_url" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mt_student_profiles_username_unique_idx" ON "mt_student_profiles" ("username");
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" ALTER COLUMN "graduation_year" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" DROP CONSTRAINT IF EXISTS "mt_programming_club_memberships_graduation_year_valid";
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" ADD CONSTRAINT "mt_programming_club_memberships_graduation_year_valid" CHECK ("graduation_year" IS NULL OR ("graduation_year" >= 2026 AND "graduation_year" <= 2040));
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" ADD COLUMN IF NOT EXISTS "year_level" varchar(8);
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" ADD COLUMN IF NOT EXISTS "club_goals" text;
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" DROP CONSTRAINT IF EXISTS "mt_programming_club_memberships_year_level_valid";
--> statement-breakpoint
ALTER TABLE "mt_programming_club_memberships" ADD CONSTRAINT "mt_programming_club_memberships_year_level_valid" CHECK ("year_level" IS NULL OR "year_level" IN ('first', 'second', 'third'));
--> statement-breakpoint
DO $grant$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mariprogramming_runtime') THEN
		EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "mt_programming_club_memberships" TO mariprogramming_runtime';
	END IF;
END
$grant$;
