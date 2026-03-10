import { z } from 'zod';
import { validate } from './validate';

/**
 * Smart Test Selection — Input Validation Schemas
 *
 * Validates requests to the CI smart-select endpoint.
 * Follows the same pattern as pipeline.ts validation schemas.
 */

export const smartSelectSchema = z.object({
  files: z.array(z.string().min(1, 'Each file path must be non-empty'))
    .min(1, 'At least one file path is required'),
  options: z.object({
    projectRoot: z.string().optional(),
    testPatterns: z.array(z.string()).optional(),
    globalFiles: z.array(z.string()).optional(),
    validateFileExistence: z.boolean().optional(),
    useDependencyGraph: z.boolean().optional(),
    useCoverageMap: z.boolean().optional(),
    useCorrelation: z.boolean().optional(),
    excludeQuarantined: z.boolean().optional(),
  }).optional(),
});

export const coverageUploadSchema = z.object({
  format: z.enum(['lcov', 'istanbul', 'cobertura'], {
    errorMap: () => ({ message: 'Format must be one of: lcov, istanbul, cobertura' }),
  }),
  pipelineId: z.string().optional(),
  branch: z.string().optional(),
});

export const validateSmartSelect = validate(smartSelectSchema);
export const validateCoverageUpload = validate(coverageUploadSchema);

export type SmartSelectInput = z.infer<typeof smartSelectSchema>;
export type CoverageUploadInput = z.infer<typeof coverageUploadSchema>;
