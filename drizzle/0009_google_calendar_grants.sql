CREATE TABLE "mt_google_calendar_grants" (
	"user_id" text PRIMARY KEY NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_google_calendar_grants_version_positive" CHECK ("mt_google_calendar_grants"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "mt_google_calendar_grants" ADD CONSTRAINT "mt_google_calendar_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
