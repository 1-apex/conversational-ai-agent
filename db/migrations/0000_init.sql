CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"correlation_id" text,
	"metadata" jsonb,
	"prev_hash" text,
	"entry_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_summaries" (
	"call_id" uuid PRIMARY KEY NOT NULL,
	"intelligence" jsonb NOT NULL,
	"method" text NOT NULL,
	"model_id" text,
	"human_corrected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_turns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"call_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"speaker" text NOT NULL,
	"agent" text,
	"text_content" text NOT NULL,
	"pathway" text,
	"validation_status" text,
	"prompt_version" text,
	"policy_version" text,
	"model_id" text,
	"timings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"state" text NOT NULL,
	"active_agent" text NOT NULL,
	"data_mode" text DEFAULT 'synthetic' NOT NULL,
	"emergency_locked" boolean DEFAULT false NOT NULL,
	"sentiment" text,
	"agents_used" text[] DEFAULT '{}' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retention_expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escalation_id" uuid NOT NULL,
	"actor_id" uuid,
	"event_type" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"priority" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"encrypted_contact" text,
	"preferred_window" text,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"passed" boolean NOT NULL,
	"failures" text[] NOT NULL,
	"snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" text NOT NULL,
	"dataset_version" text NOT NULL,
	"dataset_hash" text NOT NULL,
	"provider" text,
	"model_id" text,
	"prompt_version" text NOT NULL,
	"policy_version" text NOT NULL,
	"knowledge_version" text NOT NULL,
	"code_commit" text,
	"aggregates" jsonb NOT NULL,
	"gate_result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"owner_id" uuid,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"section" text NOT NULL,
	"source_location" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1536),
	"search_vector" "tsvector"
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"product" text,
	"audience" text DEFAULT 'consumer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"content_hash" text NOT NULL,
	"flags" text[] DEFAULT '{}' NOT NULL,
	"effective_date" date,
	"expiry_date" date,
	"uploaded_by" uuid NOT NULL,
	"approved_by" uuid,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"failure_class" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'open' NOT NULL,
	"proposed_case" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"turn_id" uuid,
	"stage" text NOT NULL,
	"categories" text[] NOT NULL,
	"severity" text NOT NULL,
	"rule_ids" text[] NOT NULL,
	"action_taken" text NOT NULL,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "turn_citations" (
	"turn_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	CONSTRAINT "turn_citations_turn_id_chunk_id_pk" PRIMARY KEY("turn_id","chunk_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_turns" ADD CONSTRAINT "call_turns_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_escalation_id_escalations_id_fk" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_run_id_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_version_id_knowledge_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_citations" ADD CONSTRAINT "turn_citations_chunk_id_knowledge_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."knowledge_chunks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_citations" ADD CONSTRAINT "turn_citations_version_id_knowledge_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."knowledge_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_index" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_type_target_id_index" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "call_turns_call_id_sequence_index" ON "call_turns" USING btree ("call_id","sequence");--> statement-breakpoint
CREATE INDEX "calls_organization_id_started_at_index" ON "calls" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE INDEX "calls_retention_expires_at_index" ON "calls" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE INDEX "escalations_organization_id_status_priority_created_at_index" ON "escalations" USING btree ("organization_id","status","priority","created_at");--> statement-breakpoint
CREATE INDEX "evaluation_results_run_id_passed_index" ON "evaluation_results" USING btree ("run_id","passed");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_version_id_index" ON "knowledge_chunks" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_search_vector_index" ON "knowledge_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_versions_document_id_version_index" ON "knowledge_versions" USING btree ("document_id","version");--> statement-breakpoint
CREATE INDEX "knowledge_versions_status_index" ON "knowledge_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "safety_events_organization_id_created_at_severity_index" ON "safety_events" USING btree ("organization_id","created_at","severity");--> statement-breakpoint
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
