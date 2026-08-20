CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"resource_type" varchar(32) NOT NULL,
	"resource_id" uuid NOT NULL,
	"actor_kind" varchar(24) NOT NULL,
	"staff_user_id" text,
	"staff_identity" varchar(320),
	"action" varchar(80) NOT NULL,
	"previous_state" jsonb,
	"next_state" jsonb,
	"request_id" varchar(128),
	"provider_event_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_actor_kind_valid" CHECK ("audit_log"."actor_kind" IN ('customer', 'staff', 'stripe', 'system', 'maintenance')),
	CONSTRAINT "audit_log_staff_identity_consistent" CHECK (("audit_log"."actor_kind" = 'staff' AND "audit_log"."staff_user_id" IS NOT NULL AND "audit_log"."staff_identity" IS NOT NULL) OR ("audit_log"."actor_kind" <> 'staff' AND "audit_log"."staff_user_id" IS NULL AND "audit_log"."staff_identity" IS NULL)),
	CONSTRAINT "audit_log_resource_target_valid" CHECK (("audit_log"."resource_type" = 'order' AND "audit_log"."order_id" IS NOT NULL AND "audit_log"."resource_id" = "audit_log"."order_id") OR ("audit_log"."resource_type" IN ('teacher', 'course', 'bookstore', 'book', 'course_book') AND "audit_log"."order_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookstore_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"author" varchar(200),
	"isbn" varchar(32),
	"retailer_url" varchar(2048) NOT NULL,
	"cover_url" varchar(2048),
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_price_nonnegative" CHECK ("books"."price_cents" >= 0),
	CONSTRAINT "books_version_positive" CHECK ("books"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "bookstores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"service_fee_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookstores_service_fee_range" CHECK ("bookstores"."service_fee_cents" >= 500 AND "bookstores"."service_fee_cents" <= 700),
	CONSTRAINT "bookstores_version_positive" CHECK ("bookstores"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "checkout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"client_request_id" varchar(128) NOT NULL,
	"request_fingerprint" varchar(128) NOT NULL,
	"stripe_idempotency_key" varchar(255) NOT NULL,
	"stripe_session_id" varchar(255),
	"payment_intent_id" varchar(255),
	"stripe_expires_at" timestamp with time zone,
	"checkout_ready_at" timestamp with time zone,
	"terminal_at" timestamp with time zone,
	"status" varchar(24) DEFAULT 'created' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_attempts_status_valid" CHECK ("checkout_attempts"."status" IN ('created', 'ready', 'completed', 'expired', 'failed')),
	CONSTRAINT "checkout_attempts_version_positive" CHECK ("checkout_attempts"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "course_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_books_position_nonnegative" CHECK ("course_books"."position" >= 0),
	CONSTRAINT "course_books_version_positive" CHECK ("course_books"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_version_positive" CHECK ("courses"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" varchar(24) NOT NULL,
	"label" varchar(240) NOT NULL,
	"isbn" varchar(32),
	"bookstore_id" uuid NOT NULL,
	"bookstore_name" varchar(160) NOT NULL,
	"book_id" uuid,
	"teacher_id" uuid,
	"teacher_name" varchar(160),
	"course_id" uuid,
	"course_code" varchar(64),
	"course_title" varchar(200),
	"quantity" integer NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"line_amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_lines_kind_valid" CHECK ("order_lines"."kind" IN ('book', 'service_fee')),
	CONSTRAINT "order_lines_quantity_positive" CHECK ("order_lines"."quantity" > 0),
	CONSTRAINT "order_lines_unit_amount_nonnegative" CHECK ("order_lines"."unit_amount_cents" >= 0),
	CONSTRAINT "order_lines_amount_nonnegative" CHECK ("order_lines"."line_amount_cents" >= 0),
	CONSTRAINT "order_lines_amount_equation" CHECK ("order_lines"."line_amount_cents" = "order_lines"."quantity" * "order_lines"."unit_amount_cents"),
	CONSTRAINT "order_lines_service_fee_valid" CHECK ("order_lines"."kind" <> 'service_fee' OR ("order_lines"."quantity" = 1 AND "order_lines"."unit_amount_cents" >= 500 AND "order_lines"."unit_amount_cents" <= 700)),
	CONSTRAINT "order_lines_snapshot_kind_consistent" CHECK (("order_lines"."kind" = 'book' AND "order_lines"."book_id" IS NOT NULL AND "order_lines"."teacher_id" IS NOT NULL AND "order_lines"."teacher_name" IS NOT NULL AND "order_lines"."course_id" IS NOT NULL AND "order_lines"."course_code" IS NOT NULL AND "order_lines"."course_title" IS NOT NULL) OR ("order_lines"."kind" = 'service_fee' AND "order_lines"."book_id" IS NULL AND "order_lines"."teacher_id" IS NULL AND "order_lines"."teacher_name" IS NULL AND "order_lines"."course_id" IS NULL AND "order_lines"."course_code" IS NULL AND "order_lines"."course_title" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_name" varchar(160) NOT NULL,
	"customer_email" varchar(320) NOT NULL,
	"public_reference" varchar(64) NOT NULL,
	"confirmation_token_hash" varchar(128),
	"confirmation_expires_at" timestamp with time zone,
	"currency" varchar(3) DEFAULT 'cad' NOT NULL,
	"payment_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"fulfillment_status" varchar(32) DEFAULT 'unstarted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"service_fee_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pii_purge_after" timestamp with time zone,
	CONSTRAINT "orders_currency_cad" CHECK ("orders"."currency" = 'cad'),
	CONSTRAINT "orders_payment_status_valid" CHECK ("orders"."payment_status" IN ('pending', 'paid', 'partially_refunded', 'refunded', 'expired', 'failed', 'cancelled')),
	CONSTRAINT "orders_fulfillment_status_valid" CHECK ("orders"."fulfillment_status" IN ('unstarted', 'purchasing', 'received', 'ready_for_pickup', 'picked_up')),
	CONSTRAINT "orders_amounts_nonnegative" CHECK ("orders"."subtotal_cents" >= 0 AND "orders"."service_fee_cents" >= 0 AND "orders"."tax_cents" >= 0 AND "orders"."total_cents" >= 0),
	CONSTRAINT "orders_total_equation" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" + "orders"."service_fee_cents" + "orders"."tax_cents"),
	CONSTRAINT "orders_confirmation_pair" CHECK (("orders"."confirmation_token_hash" IS NULL AND "orders"."confirmation_expires_at" IS NULL) OR ("orders"."confirmation_token_hash" IS NOT NULL AND "orders"."confirmation_expires_at" IS NOT NULL)),
	CONSTRAINT "orders_version_positive" CHECK ("orders"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"bucket_key" varchar(255) PRIMARY KEY NOT NULL,
	"scope" varchar(40) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_scope_valid" CHECK ("rate_limit_buckets"."scope" IN ('checkout_email', 'checkout_client_address', 'staff_session', 'staff_action')),
	CONSTRAINT "rate_limit_buckets_count_nonnegative" CHECK ("rate_limit_buckets"."count" >= 0),
	CONSTRAINT "rate_limit_buckets_window_valid" CHECK ("rate_limit_buckets"."expires_at" > "rate_limit_buckets"."window_started_at"),
	CONSTRAINT "rate_limit_buckets_version_positive" CHECK ("rate_limit_buckets"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(64) NOT NULL,
	"mode" varchar(8) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"disposition" varchar(40) NOT NULL,
	CONSTRAINT "stripe_events_type_valid" CHECK (btrim("stripe_events"."type") <> ''),
	CONSTRAINT "stripe_events_mode_valid" CHECK ("stripe_events"."mode" IN ('test', 'live')),
	CONSTRAINT "stripe_events_disposition_valid" CHECK ("stripe_events"."disposition" IN ('applied', 'duplicate', 'stale', 'ignored_unsupported_type', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_version_positive" CHECK ("teachers"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_staff_user_id_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_provider_event_id_stripe_events_id_fk" FOREIGN KEY ("provider_event_id") REFERENCES "public"."stripe_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_bookstore_id_bookstores_id_fk" FOREIGN KEY ("bookstore_id") REFERENCES "public"."bookstores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_books" ADD CONSTRAINT "course_books_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_books" ADD CONSTRAINT "course_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_bookstore_id_bookstores_id_fk" FOREIGN KEY ("bookstore_id") REFERENCES "public"."bookstores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_order_created_idx" ON "audit_log" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_request_id_idx" ON "audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_log_provider_event_id_idx" ON "audit_log" USING btree ("provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "books_isbn_unique_idx" ON "books" USING btree ("isbn");--> statement-breakpoint
CREATE INDEX "books_bookstore_idx" ON "books" USING btree ("bookstore_id");--> statement-breakpoint
CREATE INDEX "books_active_idx" ON "books" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "bookstores_name_unique_idx" ON "bookstores" USING btree ("name");--> statement-breakpoint
CREATE INDEX "bookstores_active_idx" ON "bookstores" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_attempts_client_request_id_unique_idx" ON "checkout_attempts" USING btree ("client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_attempts_stripe_idempotency_key_unique_idx" ON "checkout_attempts" USING btree ("stripe_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_attempts_stripe_session_id_unique_idx" ON "checkout_attempts" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_attempts_payment_intent_id_unique_idx" ON "checkout_attempts" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "checkout_attempts_order_idx" ON "checkout_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "checkout_attempts_status_idx" ON "checkout_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checkout_attempts_created_at_idx" ON "checkout_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "course_books_course_book_unique_idx" ON "course_books" USING btree ("course_id","book_id");--> statement-breakpoint
CREATE INDEX "course_books_course_idx" ON "course_books" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_books_book_idx" ON "course_books" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "course_books_active_idx" ON "course_books" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_teacher_code_unique_idx" ON "courses" USING btree ("teacher_id","code");--> statement-breakpoint
CREATE INDEX "courses_teacher_idx" ON "courses" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "courses_active_idx" ON "courses" USING btree ("active");--> statement-breakpoint
CREATE INDEX "order_lines_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_lines_bookstore_idx" ON "order_lines" USING btree ("bookstore_id");--> statement-breakpoint
CREATE INDEX "order_lines_teacher_idx" ON "order_lines" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "order_lines_course_idx" ON "order_lines" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "order_lines_book_idx" ON "order_lines" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_public_reference_unique_idx" ON "orders" USING btree ("public_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_confirmation_token_hash_unique_idx" ON "orders" USING btree ("confirmation_token_hash");--> statement-breakpoint
CREATE INDEX "orders_payment_fulfillment_idx" ON "orders" USING btree ("payment_status","fulfillment_status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_pii_purge_after_idx" ON "orders" USING btree ("pii_purge_after");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_scope_idx" ON "rate_limit_buckets" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stripe_events_received_at_idx" ON "stripe_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "stripe_events_processed_at_idx" ON "stripe_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_slug_unique_idx" ON "teachers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "teachers_active_idx" ON "teachers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
--> statement-breakpoint
CREATE FUNCTION "deny_immutable_row_change"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "order_lines_immutable"
BEFORE UPDATE OR DELETE ON "order_lines"
FOR EACH ROW EXECUTE FUNCTION "deny_immutable_row_change"();
--> statement-breakpoint
CREATE TRIGGER "audit_log_append_only"
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION "deny_immutable_row_change"();
