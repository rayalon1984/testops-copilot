-- CreateIndex
CREATE UNIQUE INDEX "unique_pipeline_build" ON "test_runs"("pipelineId", "buildNumber");
