ALTER TABLE "mt_student_profiles"
	ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone,
	ADD COLUMN IF NOT EXISTS "banned_at" timestamp with time zone;
