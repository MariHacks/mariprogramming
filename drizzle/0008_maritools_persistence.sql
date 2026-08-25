CREATE TABLE "mt_academic_terms" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"start_date" varchar(10) NOT NULL,
	"end_date" varchar(10) NOT NULL,
	"class_start_date" varchar(10) NOT NULL,
	"class_end_date" varchar(10) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_academic_terms_status_valid" CHECK ("mt_academic_terms"."status" IN ('active', 'historical')),
	CONSTRAINT "mt_academic_terms_version_positive" CHECK ("mt_academic_terms"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_academic_calendar_rules" (
	"term_id" varchar(64) PRIMARY KEY NOT NULL,
	"no_class_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_academic_calendar_rules_version_positive" CHECK ("mt_academic_calendar_rules"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"canonical_title" varchar(240) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_courses_version_positive" CHECK ("mt_courses"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_course_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"term_id" varchar(64) NOT NULL,
	"section" varchar(80) NOT NULL,
	"teacher_name" varchar(160) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_course_offerings_version_positive" CHECK ("mt_course_offerings"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_student_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"student_id" varchar(32) NOT NULL,
	"display_name" varchar(120),
	"role" varchar(16) DEFAULT 'student' NOT NULL,
	"nim_disclosure_accepted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_student_profiles_role_valid" CHECK ("mt_student_profiles"."role" IN ('student', 'moderator', 'staff')),
	CONSTRAINT "mt_student_profiles_version_positive" CHECK ("mt_student_profiles"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_outline_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"byte_length" integer NOT NULL,
	"extracted_text" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_outline_documents_byte_length_positive" CHECK ("mt_outline_documents"."byte_length" > 0),
	CONSTRAINT "mt_outline_documents_version_positive" CHECK ("mt_outline_documents"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_outline_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_sha256" varchar(64) NOT NULL,
	"offering_id" uuid,
	"proposals" jsonb NOT NULL,
	"model" varchar(120),
	"inference_count" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_outline_extractions_inference_positive" CHECK ("mt_outline_extractions"."inference_count" > 0),
	CONSTRAINT "mt_outline_extractions_version_positive" CHECK ("mt_outline_extractions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_catalog_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"contributor_user_id" text,
	"document_sha256" varchar(64) NOT NULL,
	"structured" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'published' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_catalog_contributions_status_valid" CHECK ("mt_catalog_contributions"."status" IN ('published', 'conflict', 'withdrawn')),
	CONSTRAINT "mt_catalog_contributions_version_positive" CHECK ("mt_catalog_contributions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"category" varchar(80),
	"description" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_clubs_version_positive" CHECK ("mt_clubs"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_club_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitter_user_id" text,
	"club_id" uuid,
	"payload" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_club_submissions_status_valid" CHECK ("mt_club_submissions"."status" IN ('pending', 'published', 'rejected')),
	CONSTRAINT "mt_club_submissions_version_positive" CHECK ("mt_club_submissions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_forum_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" text NOT NULL,
	"title" varchar(240) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(32) NOT NULL,
	"course_id" uuid,
	"offering_id" uuid,
	"term_id" varchar(64),
	"locked_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_forum_threads_category_valid" CHECK ("mt_forum_threads"."category" IN ('courses', 'student-life')),
	CONSTRAINT "mt_forum_threads_version_positive" CHECK ("mt_forum_threads"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_forum_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"removed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_forum_replies_version_positive" CHECK ("mt_forum_replies"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_forum_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_kind" varchar(16) NOT NULL,
	"target_id" uuid NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" varchar(500) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_forum_reports_target_kind_valid" CHECK ("mt_forum_reports"."target_kind" IN ('thread', 'reply')),
	CONSTRAINT "mt_forum_reports_status_valid" CHECK ("mt_forum_reports"."status" IN ('open', 'resolved', 'dismissed')),
	CONSTRAINT "mt_forum_reports_version_positive" CHECK ("mt_forum_reports"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "mt_academic_calendar_rules" ADD CONSTRAINT "mt_academic_calendar_rules_term_id_mt_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."mt_academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_course_offerings" ADD CONSTRAINT "mt_course_offerings_course_id_mt_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."mt_courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_course_offerings" ADD CONSTRAINT "mt_course_offerings_term_id_mt_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."mt_academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_student_profiles" ADD CONSTRAINT "mt_student_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_outline_documents" ADD CONSTRAINT "mt_outline_documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_outline_extractions" ADD CONSTRAINT "mt_outline_extractions_offering_id_mt_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."mt_course_offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_catalog_contributions" ADD CONSTRAINT "mt_catalog_contributions_offering_id_mt_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."mt_course_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_catalog_contributions" ADD CONSTRAINT "mt_catalog_contributions_contributor_user_id_user_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_club_submissions" ADD CONSTRAINT "mt_club_submissions_submitter_user_id_user_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_club_submissions" ADD CONSTRAINT "mt_club_submissions_club_id_mt_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."mt_clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_forum_threads" ADD CONSTRAINT "mt_forum_threads_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_forum_threads" ADD CONSTRAINT "mt_forum_threads_course_id_mt_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."mt_courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_forum_threads" ADD CONSTRAINT "mt_forum_threads_offering_id_mt_course_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."mt_course_offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_forum_threads" ADD CONSTRAINT "mt_forum_threads_term_id_mt_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."mt_academic_terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_forum_replies" ADD CONSTRAINT "mt_forum_replies_thread_id_mt_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."mt_forum_threads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_forum_replies" ADD CONSTRAINT "mt_forum_replies_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mt_forum_reports" ADD CONSTRAINT "mt_forum_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mt_courses_code_unique_idx" ON "mt_courses" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "mt_course_offerings_identity_unique_idx" ON "mt_course_offerings" USING btree ("term_id","course_id","section","teacher_name");--> statement-breakpoint
CREATE INDEX "mt_course_offerings_term_idx" ON "mt_course_offerings" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "mt_course_offerings_course_idx" ON "mt_course_offerings" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mt_student_profiles_student_id_unique_idx" ON "mt_student_profiles" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mt_outline_documents_user_sha_unique_idx" ON "mt_outline_documents" USING btree ("user_id","sha256");--> statement-breakpoint
CREATE INDEX "mt_outline_documents_sha_idx" ON "mt_outline_documents" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "mt_outline_extractions_sha_offering_unique_idx" ON "mt_outline_extractions" USING btree ("document_sha256","offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mt_outline_extractions_sha_null_offering_unique_idx" ON "mt_outline_extractions" USING btree ("document_sha256") WHERE "offering_id" IS NULL;--> statement-breakpoint
CREATE INDEX "mt_outline_extractions_sha_idx" ON "mt_outline_extractions" USING btree ("document_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "mt_catalog_contributions_offering_sha_unique_idx" ON "mt_catalog_contributions" USING btree ("offering_id","document_sha256");--> statement-breakpoint
CREATE INDEX "mt_catalog_contributions_offering_idx" ON "mt_catalog_contributions" USING btree ("offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mt_clubs_slug_unique_idx" ON "mt_clubs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "mt_clubs_published_idx" ON "mt_clubs" USING btree ("published");--> statement-breakpoint
CREATE INDEX "mt_club_submissions_status_idx" ON "mt_club_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mt_forum_threads_category_idx" ON "mt_forum_threads" USING btree ("category");--> statement-breakpoint
CREATE INDEX "mt_forum_threads_course_idx" ON "mt_forum_threads" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "mt_forum_replies_thread_idx" ON "mt_forum_replies" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "mt_forum_reports_status_idx" ON "mt_forum_reports" USING btree ("status");
