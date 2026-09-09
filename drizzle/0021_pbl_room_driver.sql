ALTER TABLE "pbl_rooms" ADD COLUMN "driver_member_id" varchar(64);
--> statement-breakpoint
UPDATE "pbl_rooms" SET "driver_member_id" = (
	SELECT "pbl_room_members"."member_id"
	FROM "pbl_room_members"
	WHERE "pbl_room_members"."room_id" = "pbl_rooms"."id"
	ORDER BY "pbl_room_members"."joined_at" ASC
	LIMIT 1
);
