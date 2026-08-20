DROP TABLE "rate_limit";--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" DROP CONSTRAINT "rate_limit_buckets_scope_valid";--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_scope_valid" CHECK ("rate_limit_buckets"."scope" IN ('auth_request', 'checkout_email', 'checkout_client_address', 'staff_session', 'staff_action'));
