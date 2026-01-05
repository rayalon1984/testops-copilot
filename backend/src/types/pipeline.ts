import { JsonValue } from '@prisma/client/runtime/library';
import { PipelineType, PipelineStatus, TestStatus } from '../constants';

export interface Pipeline {
  id: string;
  name: string;
  type: PipelineType;
  status: PipelineStatus;
  config: JsonValue;
  createdAt: Date;
  updatedAt: Date;
  userId?: string; // Optional now
  testRuns?: TestRun[];
}

export interface TestRun {
  id: string;
  pipelineId: string;
  userId: string | null;
  status: TestStatus;
  branch: string | null;
  commit: string | null;
  startTime: Date | null;
  endTime: Date | null;
  duration: number | null;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  results: JsonValue;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  pipeline?: Pipeline;
}

export interface CreatePipelineDTO {
  name: string;
  type: PipelineType;
  config: JsonValue;
}

export interface UpdatePipelineDTO {
  name?: string;
  config?: JsonValue;
  status?: PipelineStatus;
  type?: PipelineType;
}

export interface CreateTestRunDTO {
  pipelineId: string;
  branch?: string;
  commit?: string;
  parameters?: Record<string, unknown>;
}

export interface UpdateTestRunDTO {
  status?: TestStatus;
  results?: JsonValue;
  error?: string | null;
  endTime?: Date;
  duration?: number;
}

export interface PipelineWithTestRuns extends Pipeline {
  testRuns: TestRun[];
}

export interface TestRunWithPipeline extends TestRun {
  pipeline: Pipeline;
}

export interface TestRunFilters {
  pipelineId?: string;
  status?: TestStatus;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PipelineFilters {
  type?: PipelineType;
  status?: PipelineStatus;
  startDate?: Date;
  endDate?: Date;
}

// Type guard to check if a pipeline is a PipelineWithTestRuns
export function isPipelineWithTestRuns(pipeline: Pipeline): pipeline is PipelineWithTestRuns {
  return Array.isArray((pipeline as PipelineWithTestRuns).testRuns);
}

// Type guard to check if a test run is a TestRunWithPipeline
export function isTestRunWithPipeline(testRun: TestRun): testRun is TestRunWithPipeline {
  return !!(testRun as TestRunWithPipeline).pipeline;
}

// Convert Prisma pipeline to our Pipeline type
export function toPipeline(prismaPipeline: any): Pipeline {
  return {
    ...prismaPipeline,
    type: prismaPipeline.type as PipelineType,
    status: (prismaPipeline.status || PipelineStatus.PENDING) as PipelineStatus,
    userId: prismaPipeline.userId || '' // Default or empty if missing
  };
}

// Convert Prisma test run to our TestRun type
export function toTestRun(prismaTestRun: any): TestRun {
  return {
    ...prismaTestRun,
    status: prismaTestRun.status as TestStatus,
    startTime: prismaTestRun.startedAt || prismaTestRun.startTime,
    endTime: prismaTestRun.completedAt || prismaTestRun.endTime,
    results: prismaTestRun.results || {}, // Ensure generic JSON
    error: prismaTestRun.metadata?.error || prismaTestRun.error || null
  };
}