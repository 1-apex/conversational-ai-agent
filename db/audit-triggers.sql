-- Appended to the first generated migration. Kept here so it's easy to read.
-- Together these make audit_logs tamper-evident: rows can't be changed through normal
-- SQL, and each row's hash covers the previous row's hash.

CREATE FUNCTION audit_logs_chain() RETURNS trigger AS $$
DECLARE
  last_hash text;
BEGIN
  -- Serializes writers, so two inserts can't share a previous hash
  PERFORM pg_advisory_xact_lock(727001);
  SELECT entry_hash INTO last_hash FROM audit_logs ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := last_hash;
  NEW.entry_hash := encode(sha256(convert_to(
    concat_ws('|', coalesce(last_hash, ''), NEW.action, coalesce(NEW.actor_id::text, ''),
      coalesce(NEW.target_type, ''), coalesce(NEW.target_id, ''),
      coalesce(NEW.metadata::text, ''), NEW.created_at::text),
    'UTF8')), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_chain_trigger BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_chain();
--> statement-breakpoint
CREATE FUNCTION audit_logs_block_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_change();
--> statement-breakpoint
-- Second-person approval is enforced by the database, not only the application
ALTER TABLE knowledge_versions ADD CONSTRAINT knowledge_versions_second_person
  CHECK (approved_by IS NULL OR approved_by <> uploaded_by);
--> statement-breakpoint
CREATE FUNCTION knowledge_chunks_search() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.section || ' ' || NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER knowledge_chunks_search_trigger BEFORE INSERT OR UPDATE ON knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION knowledge_chunks_search();
