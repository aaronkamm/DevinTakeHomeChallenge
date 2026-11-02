CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"refund_id" text NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"actor_role" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"amount_cents" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_action_check" CHECK ("audit_events"."action" IN ('created', 'approved', 'partially_approved', 'rejected', 'escalated')),
	CONSTRAINT "audit_events_actor_role_check" CHECK ("audit_events"."actor_role" IN ('agent', 'manager', 'system')),
	CONSTRAINT "audit_events_from_status_check" CHECK ("audit_events"."from_status" IS NULL OR "audit_events"."from_status" IN ('pending', 'escalated', 'approved', 'partially_approved', 'rejected')),
	CONSTRAINT "audit_events_to_status_check" CHECK ("audit_events"."to_status" IN ('pending', 'escalated', 'approved', 'partially_approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"transaction_id" text NOT NULL,
	"original_amount_cents" integer NOT NULL,
	"requested_amount_cents" integer NOT NULL,
	"approved_amount_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"decision_note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_status_check" CHECK ("refunds"."status" IN ('pending', 'escalated', 'approved', 'partially_approved', 'rejected')),
	CONSTRAINT "refunds_original_amount_check" CHECK ("refunds"."original_amount_cents" > 0),
	CONSTRAINT "refunds_requested_amount_check" CHECK ("refunds"."requested_amount_cents" > 0 AND "refunds"."requested_amount_cents" <= "refunds"."original_amount_cents"),
	CONSTRAINT "refunds_approved_amount_check" CHECK ("refunds"."approved_amount_cents" IS NULL OR ("refunds"."approved_amount_cents" > 0 AND "refunds"."approved_amount_cents" <= "refunds"."requested_amount_cents")),
	CONSTRAINT "refunds_risk_score_check" CHECK ("refunds"."risk_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_refund_id_idx" ON "audit_events" USING btree ("refund_id","created_at");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_created_at_idx" ON "refunds" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refunds_transaction_id_idx" ON "refunds" USING btree ("transaction_id");