CREATE TABLE "mt_free_time_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(240) NOT NULL,
	"term_id" varchar(64) NOT NULL,
	"owner_user_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_free_time_boards_version_positive" CHECK ("mt_free_time_boards"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "mt_free_time_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"availability" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"share_token" varchar(64),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mt_free_time_members_version_positive" CHECK ("mt_free_time_members"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mt_free_time_boards_slug_unique_idx" ON "mt_free_time_boards" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "mt_free_time_boards_term_idx" ON "mt_free_time_boards" USING btree ("term_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "mt_free_time_members_share_token_unique_idx" ON "mt_free_time_members" USING btree ("share_token");
--> statement-breakpoint
CREATE INDEX "mt_free_time_members_board_idx" ON "mt_free_time_members" USING btree ("board_id");
--> statement-breakpoint
ALTER TABLE "mt_free_time_boards" ADD CONSTRAINT "mt_free_time_boards_term_id_mt_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."mt_academic_terms"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mt_free_time_boards" ADD CONSTRAINT "mt_free_time_boards_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mt_free_time_members" ADD CONSTRAINT "mt_free_time_members_board_id_mt_free_time_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."mt_free_time_boards"("id") ON DELETE cascade ON UPDATE no action;
