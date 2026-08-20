ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_resource_target_valid";--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_resource_target_valid" CHECK (
	("resource_type" = 'order' AND "order_id" IS NOT NULL AND "resource_id" = "order_id")
	OR ("resource_type" IN ('teacher','course','bookstore','book','course_book','book_request') AND "order_id" IS NULL)
);--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" DROP CONSTRAINT "rate_limit_buckets_scope_valid";--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_scope_valid" CHECK (
	"scope" IN ('auth_request','checkout_email','checkout_client_address','staff_session','staff_action','book_request_email','book_request_client_address')
);--> statement-breakpoint

CREATE TABLE "book_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"public_reference" varchar(64) NOT NULL UNIQUE,
	"client_request_id" varchar(128) NOT NULL UNIQUE,
	"student_name" varchar(160) NOT NULL,
	"student_email" varchar(320) NOT NULL,
	"teacher_id" uuid REFERENCES "teachers"("id") ON DELETE restrict,
	"teacher_name" varchar(160),
	"course_id" uuid REFERENCES "courses"("id") ON DELETE restrict,
	"course_name" varchar(200),
	"note" varchar(1000),
	"status" varchar(24) NOT NULL DEFAULT 'submitted',
	"bookstore_id" uuid REFERENCES "bookstores"("id") ON DELETE restrict,
	"version" integer NOT NULL DEFAULT 1,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now(),
	"pii_purge_after" timestamptz,
	CONSTRAINT "book_requests_teacher_ref_exclusive" CHECK (num_nonnulls("teacher_id", "teacher_name") = 1),
	CONSTRAINT "book_requests_course_ref_exclusive" CHECK (num_nonnulls("course_id", "course_name") = 1),
	CONSTRAINT "book_requests_public_reference_shape" CHECK ("public_reference" ~ '^REQ-[A-HJ-NP-Z2-9]{12}$'),
	CONSTRAINT "book_requests_status_valid" CHECK ("status" IN ('submitted','assigned','picked_up')),
	CONSTRAINT "book_requests_assignment_consistent" CHECK (("status" = 'submitted') = ("bookstore_id" IS NULL)),
	CONSTRAINT "book_requests_version_positive" CHECK ("version" > 0)
);--> statement-breakpoint
CREATE INDEX "book_requests_created_at_idx" ON "book_requests" ("created_at" DESC, "id" DESC);--> statement-breakpoint
CREATE INDEX "book_requests_pii_purge_after_idx" ON "book_requests" ("pii_purge_after");--> statement-breakpoint

CREATE TABLE "book_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"request_id" uuid NOT NULL REFERENCES "book_requests"("id") ON DELETE restrict,
	"position" integer NOT NULL,
	"title" varchar(240) NOT NULL,
	"author" varchar(200),
	"isbn" varchar(32),
	"quantity" integer NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "book_request_items_position_unique" UNIQUE ("request_id", "position"),
	CONSTRAINT "book_request_items_quantity_range" CHECK ("quantity" BETWEEN 1 AND 20),
	CONSTRAINT "book_request_items_title_present" CHECK (btrim("title") <> '')
);--> statement-breakpoint
CREATE INDEX "book_request_items_request_idx" ON "book_request_items" ("request_id");--> statement-breakpoint

CREATE TABLE "book_request_outlines" (
	"request_id" uuid PRIMARY KEY REFERENCES "book_requests"("id") ON DELETE restrict,
	"filename" varchar(160) NOT NULL,
	"byte_length" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"content" bytea NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "book_request_outlines_byte_length_range" CHECK ("byte_length" BETWEEN 1 AND 2097152),
	CONSTRAINT "book_request_outlines_content_length" CHECK (octet_length("content") = "byte_length"),
	CONSTRAINT "book_request_outlines_sha256_shape" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "book_request_outlines_pdf_magic" CHECK (substring("content" FROM 1 FOR 5) = '\x255044462d'::bytea)
);--> statement-breakpoint

CREATE TABLE "book_pickups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"need_kind" varchar(24) NOT NULL,
	"order_id" uuid REFERENCES "orders"("id") ON DELETE restrict,
	"order_line_id" uuid REFERENCES "order_lines"("id") ON DELETE restrict,
	"request_id" uuid REFERENCES "book_requests"("id") ON DELETE restrict,
	"request_item_id" uuid REFERENCES "book_request_items"("id") ON DELETE restrict,
	"quantity" integer NOT NULL,
	"client_request_id" varchar(128) NOT NULL UNIQUE,
	"staff_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
	"staff_identity" varchar(320) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "book_pickups_need_kind_valid" CHECK ("need_kind" IN ('order_line','request_item')),
	CONSTRAINT "book_pickups_quantity_positive" CHECK ("quantity" > 0),
	CONSTRAINT "book_pickups_target_consistent" CHECK (
		("need_kind" = 'order_line' AND "order_id" IS NOT NULL AND "order_line_id" IS NOT NULL AND "request_id" IS NULL AND "request_item_id" IS NULL)
		OR ("need_kind" = 'request_item' AND "order_id" IS NULL AND "order_line_id" IS NULL AND "request_id" IS NOT NULL AND "request_item_id" IS NOT NULL)
	)
);--> statement-breakpoint
CREATE INDEX "book_pickups_order_line_idx" ON "book_pickups" ("order_line_id");--> statement-breakpoint
CREATE INDEX "book_pickups_request_item_idx" ON "book_pickups" ("request_item_id");--> statement-breakpoint

CREATE TABLE "event_deliveries" (
	"audit_id" uuid NOT NULL REFERENCES "audit_log"("id") ON DELETE restrict,
	"sink" varchar(24) NOT NULL,
	"status" varchar(16) NOT NULL DEFAULT 'pending',
	"attempts" integer NOT NULL DEFAULT 0,
	"leased_until" timestamptz,
	"next_attempt_at" timestamptz NOT NULL DEFAULT now(),
	"settled_at" timestamptz,
	"failure_reason" varchar(64),
	"version" integer NOT NULL DEFAULT 1,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY ("audit_id", "sink"),
	CONSTRAINT "event_deliveries_sink_valid" CHECK ("sink" = 'discord'),
	CONSTRAINT "event_deliveries_status_valid" CHECK ("status" IN ('pending','in_flight','delivered','skipped','dead')),
	CONSTRAINT "event_deliveries_attempts_bounded" CHECK ("attempts" BETWEEN 0 AND 6),
	CONSTRAINT "event_deliveries_lease_consistent" CHECK (("status" = 'in_flight') = ("leased_until" IS NOT NULL)),
	CONSTRAINT "event_deliveries_settled_consistent" CHECK (("status" IN ('delivered','skipped','dead')) = ("settled_at" IS NOT NULL)),
	CONSTRAINT "event_deliveries_version_positive" CHECK ("version" > 0)
);--> statement-breakpoint
CREATE INDEX "event_deliveries_claimable_idx" ON "event_deliveries" ("sink","next_attempt_at") WHERE "status" IN ('pending','in_flight');--> statement-breakpoint

CREATE TRIGGER "book_request_items_immutable" BEFORE UPDATE OR DELETE ON "book_request_items"
FOR EACH ROW EXECUTE FUNCTION "deny_immutable_row_change"();--> statement-breakpoint
CREATE TRIGGER "book_request_outlines_immutable" BEFORE UPDATE OR DELETE ON "book_request_outlines"
FOR EACH ROW EXECUTE FUNCTION "deny_immutable_row_change"();--> statement-breakpoint
CREATE TRIGGER "book_pickups_immutable" BEFORE UPDATE OR DELETE ON "book_pickups"
FOR EACH ROW EXECUTE FUNCTION "deny_immutable_row_change"();--> statement-breakpoint

CREATE FUNCTION "deny_book_request_payload_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'book request submissions are not deletable' USING ERRCODE = '55000';
	END IF;
	IF ROW(NEW."public_reference", NEW."client_request_id", NEW."teacher_id", NEW."teacher_name", NEW."course_id", NEW."course_name", NEW."note", NEW."created_at")
		IS DISTINCT FROM
	   ROW(OLD."public_reference", OLD."client_request_id", OLD."teacher_id", OLD."teacher_name", OLD."course_id", OLD."course_name", OLD."note", OLD."created_at") THEN
		RAISE EXCEPTION 'book request payload is immutable' USING ERRCODE = '55000';
	END IF;
	IF (OLD."student_name" IS DISTINCT FROM NEW."student_name" OR OLD."student_email" IS DISTINCT FROM NEW."student_email")
		AND NEW."student_email" <> '' THEN
		RAISE EXCEPTION 'book request identity is immutable' USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "book_requests_payload_immutable" BEFORE UPDATE OR DELETE ON "book_requests"
FOR EACH ROW EXECUTE FUNCTION "deny_book_request_payload_change"();--> statement-breakpoint

CREATE FUNCTION "enforce_book_pickup_quantity"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE requested integer;
DECLARE picked integer;
BEGIN
	IF NEW."need_kind" = 'order_line' THEN
		SELECT "quantity" INTO requested FROM "order_lines"
			WHERE "id" = NEW."order_line_id" AND "order_id" = NEW."order_id"
			FOR UPDATE;
		SELECT COALESCE(sum("quantity"), 0) INTO picked FROM "book_pickups" WHERE "order_line_id" = NEW."order_line_id";
	ELSE
		SELECT "quantity" INTO requested FROM "book_request_items"
			WHERE "id" = NEW."request_item_id" AND "request_id" = NEW."request_id"
			FOR UPDATE;
		SELECT COALESCE(sum("quantity"), 0) INTO picked FROM "book_pickups" WHERE "request_item_id" = NEW."request_item_id";
	END IF;
	IF requested IS NULL OR picked + NEW."quantity" > requested THEN
		RAISE EXCEPTION 'pickup exceeds requested quantity' USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "book_pickups_quantity_guard" BEFORE INSERT ON "book_pickups"
FOR EACH ROW EXECUTE FUNCTION "enforce_book_pickup_quantity"();
