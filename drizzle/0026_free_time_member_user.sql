ALTER TABLE "mt_free_time_members" ADD COLUMN "user_id" text;
--> statement-breakpoint
ALTER TABLE "mt_free_time_members" ADD CONSTRAINT "mt_free_time_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "mt_free_time_members_board_user_unique_idx" ON "mt_free_time_members" USING btree ("board_id","user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "mt_free_time_members_user_idx" ON "mt_free_time_members" USING btree ("user_id");
