import { PipelineType as PrismaType } from '../types/prisma-types';
import { PipelineType, TestStatus } from '../constants';

export function mapPipelineType(type: PrismaType): PipelineType {
  switch (type) {
    case 'JENKINS':
      return PipelineType.JENKINS;
    case 'GITHUB_ACTIONS':
      return PipelineType.GITHUB_ACTIONS;
    case 'CUSTOM':
      return PipelineType.CUSTOM;
    default:
      throw new Error(`Unknown pipeline type: ${type}`);
  }
}

export function mapPrismaType(type: PipelineType): PrismaType {
  switch (type) {
    case PipelineType.JENKINS:
      return PrismaType.JENKINS;
    case PipelineType.GITHUB_ACTIONS:
      return PrismaType.GITHUB_ACTIONS;
    case PipelineType.CUSTOM:
      return PrismaType.CUSTOM;
    default:
      throw new Error(`Unknown pipeline type: ${type}`);
  }
}

export function mapTestStatus(status: string): TestStatus {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return TestStatus.PENDING;
    case 'RUNNING':
      return TestStatus.RUNNING;
    case 'PASSED':
      return TestStatus.PASSED;
    case 'FAILED':
      return TestStatus.FAILED;
    case 'SKIPPED':
      return TestStatus.SKIPPED;
    case 'ERROR':
      return TestStatus.ERROR;
    default:
      return TestStatus.ERROR;
  }
}