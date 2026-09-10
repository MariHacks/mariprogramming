ALTER TABLE "pbl_rooms" ADD COLUMN "step_sources" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "pbl_rooms" ADD COLUMN "step_yjs" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE "pbl_step_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"source" text NOT NULL,
	"passed" boolean NOT NULL,
	"message" text,
	"member_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pbl_step_submissions" ADD CONSTRAINT "pbl_step_submissions_room_id_pbl_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."pbl_rooms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pbl_step_submissions_room_idx" ON "pbl_step_submissions" USING btree ("room_id");
--> statement-breakpoint
CREATE INDEX "pbl_step_submissions_room_step_idx" ON "pbl_step_submissions" USING btree ("room_id","step");
