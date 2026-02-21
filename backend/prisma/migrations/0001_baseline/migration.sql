-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AutonomyLevel" AS ENUM ('conservative', 'balanced', 'autonomous');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED', 'FLAKY');

-- CreateEnum
CREATE TYPE "PipelineType" AS ENUM ('GITHUB_ACTIONS', 'JENKINS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TEST_FAILED', 'TEST_PASSED', 'PIPELINE_FAILED', 'PIPELINE_PASSED', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "autonomyLevel" "AutonomyLevel" NOT NULL DEFAULT 'balanced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pipelineId" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "flaky" INTEGER NOT NULL DEFAULT 0,
    "branch" TEXT,
    "commit" TEXT,
    "buildNumber" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "PipelineType" NOT NULL,
    "repository" TEXT,
    "branch" TEXT,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "teamId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testRunId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "className" TEXT,
    "status" "TestStatus" NOT NULL,
    "duration" INTEGER,
    "error" TEXT,
    "stackTrace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "testRunId" UUID,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_archive" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testName" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "category" TEXT,
    "severity" TEXT,
    "rcaDocumented" BOOLEAN NOT NULL DEFAULT false,
    "rootCause" TEXT,
    "solution" TEXT,
    "prevention" TEXT,
    "relatedJiraIssue" TEXT,
    "tags" TEXT,
    "metadata" JSONB,
    "firstOccurrence" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOccurrence" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "rcaVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rca_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "failureArchiveId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rootCause" TEXT,
    "solution" TEXT,
    "prevention" TEXT,
    "tags" TEXT,
    "editedBy" TEXT NOT NULL,
    "editSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rca_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "failureArchiveId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_patterns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "signature" TEXT NOT NULL,
    "patternName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedTests" TEXT,
    "commonRootCause" TEXT,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recurrenceRule" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "userId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jiraKey" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "assignee" TEXT,
    "reporter" TEXT,
    "testRunId" UUID,
    "failureArchiveId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jira_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confluence_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pageId" TEXT NOT NULL,
    "spaceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "failureArchiveId" UUID,
    "publishedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confluence_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testrail_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testRailRunId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "suiteId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "testRunId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testrail_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "activePersona" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "persona" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "toolName" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "model" TEXT NOT NULL DEFAULT 'mock-model',
    "apiKey" TEXT,
    "extraConfig" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "persona" TEXT,
    "toolSummary" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_user_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: users
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex: test_runs
CREATE INDEX "test_runs_userId_idx" ON "test_runs"("userId");
CREATE INDEX "test_runs_pipelineId_idx" ON "test_runs"("pipelineId");
CREATE INDEX "test_runs_status_idx" ON "test_runs"("status");
CREATE INDEX "test_runs_startedAt_idx" ON "test_runs"("startedAt");

-- CreateIndex: pipelines
CREATE INDEX "pipelines_teamId_idx" ON "pipelines"("teamId");

-- CreateIndex: test_results
CREATE INDEX "test_results_testRunId_idx" ON "test_results"("testRunId");
CREATE INDEX "test_results_status_idx" ON "test_results"("status");

-- CreateIndex: notifications
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex: failure_archive
CREATE INDEX "failure_archive_testName_idx" ON "failure_archive"("testName");
CREATE INDEX "failure_archive_category_idx" ON "failure_archive"("category");
CREATE INDEX "failure_archive_resolved_idx" ON "failure_archive"("resolved");

-- CreateIndex: rca_revisions
CREATE INDEX "rca_revisions_failureArchiveId_idx" ON "rca_revisions"("failureArchiveId");

-- CreateIndex: failure_comments
CREATE INDEX "failure_comments_failureArchiveId_idx" ON "failure_comments"("failureArchiveId");
CREATE INDEX "failure_comments_userId_idx" ON "failure_comments"("userId");

-- CreateIndex: failure_patterns
CREATE UNIQUE INDEX "failure_patterns_signature_key" ON "failure_patterns"("signature");
CREATE INDEX "failure_patterns_signature_idx" ON "failure_patterns"("signature");
CREATE INDEX "failure_patterns_isActive_idx" ON "failure_patterns"("isActive");

-- CreateIndex: ai_usage
CREATE INDEX "ai_usage_provider_idx" ON "ai_usage"("provider");
CREATE INDEX "ai_usage_feature_idx" ON "ai_usage"("feature");
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex: jira_issues
CREATE UNIQUE INDEX "jira_issues_jiraKey_key" ON "jira_issues"("jiraKey");
CREATE INDEX "jira_issues_jiraKey_idx" ON "jira_issues"("jiraKey");
CREATE INDEX "jira_issues_projectKey_idx" ON "jira_issues"("projectKey");

-- CreateIndex: confluence_pages
CREATE UNIQUE INDEX "confluence_pages_pageId_key" ON "confluence_pages"("pageId");
CREATE INDEX "confluence_pages_spaceKey_idx" ON "confluence_pages"("spaceKey");

-- CreateIndex: testrail_runs
CREATE UNIQUE INDEX "testrail_runs_testRailRunId_key" ON "testrail_runs"("testRailRunId");
CREATE INDEX "testrail_runs_projectId_idx" ON "testrail_runs"("projectId");

-- CreateIndex: chat_sessions
CREATE INDEX "chat_sessions_userId_idx" ON "chat_sessions"("userId");

-- CreateIndex: chat_messages
CREATE INDEX "chat_messages_sessionId_idx" ON "chat_messages"("sessionId");

-- CreateIndex: pending_actions
CREATE INDEX "pending_actions_sessionId_idx" ON "pending_actions"("sessionId");
CREATE INDEX "pending_actions_userId_idx" ON "pending_actions"("userId");
CREATE INDEX "pending_actions_status_idx" ON "pending_actions"("status");

-- CreateIndex: teams
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");
CREATE INDEX "teams_slug_idx" ON "teams"("slug");

-- CreateIndex: team_members
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex: dashboard_configs
CREATE INDEX "dashboard_configs_teamId_idx" ON "dashboard_configs"("teamId");
CREATE INDEX "dashboard_configs_userId_idx" ON "dashboard_configs"("userId");

-- CreateIndex: shared_analyses
CREATE UNIQUE INDEX "shared_analyses_token_key" ON "shared_analyses"("token");
CREATE INDEX "shared_analyses_token_idx" ON "shared_analyses"("token");
CREATE INDEX "shared_analyses_userId_idx" ON "shared_analyses"("userId");
CREATE INDEX "shared_analyses_expiresAt_idx" ON "shared_analyses"("expiresAt");

-- CreateIndex: channel_user_mappings
CREATE UNIQUE INDEX "channel_user_mappings_channel_externalId_key" ON "channel_user_mappings"("channel", "externalId");
CREATE INDEX "channel_user_mappings_userId_idx" ON "channel_user_mappings"("userId");

-- AddForeignKey: test_runs
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: test_results
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: notifications
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: pipelines
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: rca_revisions
ALTER TABLE "rca_revisions" ADD CONSTRAINT "rca_revisions_failureArchiveId_fkey" FOREIGN KEY ("failureArchiveId") REFERENCES "failure_archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: failure_comments
ALTER TABLE "failure_comments" ADD CONSTRAINT "failure_comments_failureArchiveId_fkey" FOREIGN KEY ("failureArchiveId") REFERENCES "failure_archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: chat_sessions
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: chat_messages
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: pending_actions
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: team_members
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: dashboard_configs
ALTER TABLE "dashboard_configs" ADD CONSTRAINT "dashboard_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
