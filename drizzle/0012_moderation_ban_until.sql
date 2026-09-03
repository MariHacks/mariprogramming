ALTER TABLE "mt_student_profiles"
	ADD COLUMN IF NOT EXISTS "banned_until" timestamp with time zone;
