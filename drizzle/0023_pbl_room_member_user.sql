ALTER TABLE "pbl_room_members" ADD COLUMN "user_id" text;
--> statement-breakpoint
ALTER TABLE "pbl_room_members" ADD CONSTRAINT "pbl_room_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "pbl_room_members_room_user_unique_idx" ON "pbl_room_members" USING btree ("room_id","user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "pbl_room_members_user_idx" ON "pbl_room_members" USING btree ("user_id");
