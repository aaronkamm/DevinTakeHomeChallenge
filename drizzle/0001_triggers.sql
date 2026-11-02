CREATE FUNCTION refunds_set_updated_at() RETURNS trigger AS $$
BEGIN
	NEW.updated_at := now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER refunds_set_updated_at
	BEFORE UPDATE ON "refunds"
	FOR EACH ROW EXECUTE FUNCTION refunds_set_updated_at();
--> statement-breakpoint
CREATE FUNCTION audit_events_append_only() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only
	BEFORE UPDATE OR DELETE ON "audit_events"
	FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
