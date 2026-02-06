-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_archive_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "test_runs_userId_idx" ON "test_runs"("userId");
CREATE INDEX "test_runs_pipelineId_idx" ON "test_runs"("pipelineId");
CREATE INDEX "test_runs_status_idx" ON "test_runs"("status");
CREATE INDEX "test_runs_startedAt_idx" ON "test_runs"("startedAt");

-- CreateIndex
CREATE INDEX "test_results_testRunId_idx" ON "test_results"("testRunId");
CREATE INDEX "test_results_status_idx" ON "test_results"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "failure_archive_testName_idx" ON "failure_archive"("testName");
CREATE INDEX "failure_archive_category_idx" ON "failure_archive"("category");
CREATE INDEX "failure_archive_resolved_idx" ON "failure_archive"("resolved");

-- CreateIndex
CREATE INDEX "ai_usage_provider_idx" ON "ai_usage"("provider");
CREATE INDEX "ai_usage_feature_idx" ON "ai_usage"("feature");
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "jira_issues_jiraKey_key" ON "jira_issues"("jiraKey");
CREATE INDEX "jira_issues_jiraKey_idx" ON "jira_issues"("jiraKey");
CREATE INDEX "jira_issues_projectKey_idx" ON "jira_issues"("projectKey");

-- CreateIndex
CREATE UNIQUE INDEX "confluence_pages_pageId_key" ON "confluence_pages"("pageId");
CREATE INDEX "confluence_pages_spaceKey_idx" ON "confluence_pages"("spaceKey");

-- CreateIndex
CREATE UNIQUE INDEX "testrail_runs_testRailRunId_key" ON "testrail_runs"("testRailRunId");
CREATE INDEX "testrail_runs_projectId_idx" ON "testrail_runs"("projectId");

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
