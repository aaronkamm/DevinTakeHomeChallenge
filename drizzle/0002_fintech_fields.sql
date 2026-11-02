ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_role_check";--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "account_id" text NOT NULL DEFAULT 'acct_unknown';--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "account_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "payment_method" text NOT NULL DEFAULT 'card';--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "payment_method" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "merchant_name" text;--> statement-breakpoint
CREATE INDEX "refunds_account_id_idx" ON "refunds" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_role_check" CHECK ("audit_events"."actor_role" IN ('agent', 'manager', 'fraud_analyst', 'system'));--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_method_check" CHECK ("refunds"."payment_method" IN ('card', 'ach', 'wire', 'atm', 'account_fee'));