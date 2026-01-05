import { Prisma } from '@prisma/client';
import { PipelineType, PipelineStatus } from '../constants';

interface BasePipelineData {
  name: string;
  type: PipelineType;
  config: unknown;
  status?: PipelineStatus;
}

interface CreatePipelineData extends BasePipelineData {
  // userId: string; // Removed
}

interface UpdatePipelineData extends Partial<BasePipelineData> {
  id: string;
}

function mapPipelineType(type: PipelineType): string {
  return type;
}

function mapPipelineStatus(status: PipelineStatus): string {
  return status;
}

/**
 * Convert a value to Prisma's InputJsonValue type
 */
export function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) {
    return {};
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toInputJsonValue);
  }

  if (typeof value === 'object') {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = toInputJsonValue(val);
    }
    return result;
  }

  return {};
}

/**
 * Create a Prisma create input for pipeline
 */
export function createPipelineInput(data: CreatePipelineData): Prisma.PipelineCreateInput {
  return {
    name: data.name,
    // Cast string to Enum as Prisma expects Enum but we manipulate strings often
    type: data.type as any,
    // Production schema does not have status field
    // status: data.status ? mapPipelineStatus(data.status) : 'PENDING',
    config: JSON.stringify(data.config),
    // userId: data.userId // Prod schema missing userId?
  };
}

/**
 * Create a Prisma update input for pipeline
 */
export function updatePipelineInput(data: Partial<BasePipelineData>): Prisma.PipelineUpdateInput {
  const updateData: Prisma.PipelineUpdateInput = {};

  if (data.name) {
    updateData.name = data.name;
  }

  if (data.type) {
    updateData.type = mapPipelineType(data.type) as any;
  }

  // Production schema has no status field
  // if (data.status) {
  //   updateData.status = mapPipelineStatus(data.status);
  // }

  if (data.config !== undefined) {
    updateData.config = JSON.stringify(data.config);
  }

  return updateData;
}

/**
 * Parse pipeline config safely
 */
export function parsePipelineConfig<T>(config: Prisma.JsonValue | null): T {
  if (!config) {
    return {} as T;
  }

  try {
    if (typeof config === 'string') {
      return JSON.parse(config) as T;
    }
    return config as T;
  } catch {
    return {} as T;
  }
}

/**
 * Type guard for checking if a value is a valid JSON object
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for checking if a value is a valid JSON array
 */
export function isJsonArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Convert pipeline data for Prisma create
 */
export function toPrismaCreate(data: CreatePipelineData): Prisma.PipelineCreateInput {
  return createPipelineInput(data);
}

/**
 * Convert pipeline data for Prisma update
 */
export function toPrismaUpdate(data: UpdatePipelineData): Prisma.PipelineUpdateInput {
  return updatePipelineInput(data);
}

export { mapPipelineType, mapPipelineStatus };