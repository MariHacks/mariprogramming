CREATE UNIQUE INDEX IF NOT EXISTS "mt_student_profiles_username_lower_unique_idx"
	ON "mt_student_profiles" (lower("username"));
--> statement-breakpoint
DROP INDEX IF EXISTS "mt_student_profiles_username_unique_idx";
