CREATE TABLE "mt_saved_schedules" (
	"user_id" text PRIMARY KEY NOT NULL,
	"paste" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_saved_schedules_paste_not_blank" CHECK (length(btrim("paste")) > 0),
	CONSTRAINT "mt_saved_schedules_version_positive" CHECK ("mt_saved_schedules"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "mt_saved_schedules" ADD CONSTRAINT "mt_saved_schedules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
