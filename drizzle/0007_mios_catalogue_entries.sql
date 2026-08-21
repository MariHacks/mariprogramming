ALTER TABLE "courses" ADD COLUMN "section" varchar(80) DEFAULT '' NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "courses_teacher_code_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "courses_teacher_code_section_unique_idx" ON "courses" USING btree ("teacher_id","code","section");--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "bookstore_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "retailer_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "price_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "edition" varchar(240);--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "notes" varchar(500);--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "source_date" varchar(10);--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_price_nonnegative";--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_price_nonnegative" CHECK ("books"."price_cents" IS NULL OR "books"."price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_source_date_shape" CHECK ("books"."source_date" IS NULL OR "books"."source_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
