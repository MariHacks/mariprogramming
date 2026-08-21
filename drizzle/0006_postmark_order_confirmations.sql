ALTER TABLE "event_deliveries" DROP CONSTRAINT "event_deliveries_sink_valid";--> statement-breakpoint
ALTER TABLE "event_deliveries" ADD CONSTRAINT "event_deliveries_sink_valid" CHECK ("sink" IN ('discord', 'postmark'));
