-- Rollback: 0001_baseline
-- Drops all tables, indexes, and enums created by migration.sql
-- Execute with: psql -U postgres -d testops < rollback.sql

-- Drop tables (reverse creation order; CASCADE handles FK constraints)
DROP TABLE IF EXISTS "channel_user_mappings" CASCADE;
DROP TABLE IF EXISTS "shared_analyses" CASCADE;
DROP TABLE IF EXISTS "dashboard_configs" CASCADE;
DROP TABLE IF EXISTS "team_members" CASCADE;
DROP TABLE IF EXISTS "teams" CASCADE;
DROP TABLE IF EXISTS "ai_provider_config" CASCADE;
DROP TABLE IF EXISTS "pending_actions" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "chat_sessions" CASCADE;
DROP TABLE IF EXISTS "testrail_runs" CASCADE;
DROP TABLE IF EXISTS "confluence_pages" CASCADE;
DROP TABLE IF EXISTS "jira_issues" CASCADE;
DROP TABLE IF EXISTS "ai_usage" CASCADE;
DROP TABLE IF EXISTS "failure_patterns" CASCADE;
DROP TABLE IF EXISTS "failure_comments" CASCADE;
DROP TABLE IF EXISTS "rca_revisions" CASCADE;
DROP TABLE IF EXISTS "failure_archive" CASCADE;
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "test_results" CASCADE;
DROP TABLE IF EXISTS "pipelines" CASCADE;
DROP TABLE IF EXISTS "test_runs" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "NotificationType";
DROP TYPE IF EXISTS "PipelineType";
DROP TYPE IF EXISTS "TestStatus";
DROP TYPE IF EXISTS "AutonomyLevel";
DROP TYPE IF EXISTS "UserRole";
