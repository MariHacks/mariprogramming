CREATE TABLE "pbl_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"pbl_id" varchar(64) NOT NULL,
	"team_name" varchar(80) NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"unlocked_step" integer DEFAULT 0 NOT NULL,
	"last_check" jsonb,
	"opened_hints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"step_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pbl_rooms_version_positive" CHECK ("pbl_rooms"."version" > 0),
	CONSTRAINT "pbl_rooms_steps_nonnegative" CHECK ("pbl_rooms"."current_step" >= 0 AND "pbl_rooms"."unlocked_step" >= 0 AND "pbl_rooms"."unlocked_step" >= "pbl_rooms"."current_step"),
	CONSTRAINT "pbl_rooms_member_count_range" CHECK ("pbl_rooms"."member_count" >= 1 AND "pbl_rooms"."member_count" <= 10),
	CONSTRAINT "pbl_rooms_source_length" CHECK (char_length("pbl_rooms"."source") <= 100000)
);
--> statement-breakpoint
CREATE TABLE "pbl_room_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"member_id" varchar(64) NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pbl_room_members" ADD CONSTRAINT "pbl_room_members_room_id_pbl_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."pbl_rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "pbl_rooms_code_unique_idx" ON "pbl_rooms" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "pbl_rooms_pbl_id_idx" ON "pbl_rooms" USING btree ("pbl_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "pbl_room_members_room_member_unique_idx" ON "pbl_room_members" USING btree ("room_id","member_id");
--> statement-breakpoint
CREATE INDEX "pbl_room_members_room_idx" ON "pbl_room_members" USING btree ("room_id");
