CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`refund_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`actor_role` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`amount_cents` integer,
	`note` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "audit_events_action_check" CHECK("audit_events"."action" IN ('created', 'approved', 'partially_approved', 'rejected', 'escalated')),
	CONSTRAINT "audit_events_actor_role_check" CHECK("audit_events"."actor_role" IN ('agent', 'manager', 'system'))
);
--> statement-breakpoint
CREATE INDEX `audit_events_refund_id_idx` ON `audit_events` (`refund_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`transaction_id` text NOT NULL,
	`original_amount_cents` integer NOT NULL,
	`requested_amount_cents` integer NOT NULL,
	`approved_amount_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`risk_score` integer DEFAULT 0 NOT NULL,
	`decision_note` text,
	`decided_by` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	CONSTRAINT "refunds_status_check" CHECK("refunds"."status" IN ('pending', 'escalated', 'approved', 'partially_approved', 'rejected')),
	CONSTRAINT "refunds_original_amount_check" CHECK("refunds"."original_amount_cents" > 0),
	CONSTRAINT "refunds_requested_amount_check" CHECK("refunds"."requested_amount_cents" > 0 AND "refunds"."requested_amount_cents" <= "refunds"."original_amount_cents"),
	CONSTRAINT "refunds_approved_amount_check" CHECK("refunds"."approved_amount_cents" IS NULL OR ("refunds"."approved_amount_cents" > 0 AND "refunds"."approved_amount_cents" <= "refunds"."requested_amount_cents")),
	CONSTRAINT "refunds_risk_score_check" CHECK("refunds"."risk_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE INDEX `refunds_status_idx` ON `refunds` (`status`);--> statement-breakpoint
CREATE INDEX `refunds_created_at_idx` ON `refunds` (`created_at`);--> statement-breakpoint
CREATE INDEX `refunds_transaction_id_idx` ON `refunds` (`transaction_id`);