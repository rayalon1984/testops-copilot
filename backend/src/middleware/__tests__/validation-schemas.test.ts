/**
 * Guard tests for validation schemas.
 *
 * These tests ensure that Zod schemas used by validation middleware
 * do NOT use z.any() for parameter fields. Using z.any() defeats
 * the purpose of input validation and could allow unsafe data through.
 *
 * Reference: AGENTS.md §4 — "Validate inputs at system boundaries with Zod schemas"
 */

import { schemas } from '../validation';
import { z } from 'zod';

/**
 * Recursively walk a Zod schema tree and return true if z.any() is found.
 */
function containsZodAny(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodAny) return true;

  // Unwrap wrappers
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return containsZodAny(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return containsZodAny(schema.removeDefault());
  }

  // Check record values
  if (schema instanceof z.ZodRecord) {
    const valueDef = (schema as z.ZodRecord<z.ZodString, z.ZodTypeAny>)._def;
    return containsZodAny(valueDef.valueType);
  }

  // Check object shapes
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const key of Object.keys(shape)) {
      if (containsZodAny(shape[key])) return true;
    }
  }

  // Check arrays
  if (schema instanceof z.ZodArray) {
    return containsZodAny(schema.element);
  }

  return false;
}

describe('Validation schema safety guards', () => {
  const schemaEntries = Object.entries(schemas);

  it.each(schemaEntries)(
    'schema "%s" must not contain z.any()',
    (_name, schema) => {
      expect(containsZodAny(schema)).toBe(false);
    },
  );

  describe('testRun schema parameters field', () => {
    it('rejects non-primitive parameter values', () => {
      const result = schemas.testRun.safeParse({
        pipelineId: '550e8400-e29b-41d4-a716-446655440000',
        parameters: { key: { nested: 'object' } },
      });
      expect(result.success).toBe(false);
    });

    it('accepts primitive parameter values', () => {
      const result = schemas.testRun.safeParse({
        pipelineId: '550e8400-e29b-41d4-a716-446655440000',
        parameters: { branch: 'main', retries: 3, verbose: true },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('schedule schema parameters field', () => {
    it('rejects non-primitive parameter values', () => {
      const result = schemas.schedule.safeParse({
        cronExpression: '0 0 * * *',
        enabled: true,
        parameters: { key: [1, 2, 3] },
      });
      expect(result.success).toBe(false);
    });

    it('accepts primitive parameter values', () => {
      const result = schemas.schedule.safeParse({
        cronExpression: '0 0 * * *',
        enabled: true,
        parameters: { env: 'staging', timeout: 30 },
      });
      expect(result.success).toBe(true);
    });
  });
});
