import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { logger } from '@/utils/logger';

/**
 * Load the OpenAPI spec from the canonical YAML source of truth.
 * Falls back to a minimal spec if the file is missing (e.g., in CI).
 *
 * The YAML spec is consumed by:
 *   1. Swagger UI at /api/docs
 *   2. openapi-typescript to generate frontend types
 */
function loadSpec(): Record<string, unknown> {
    const specPath = path.resolve(__dirname, '../../openapi.yaml');
    try {
        const raw = fs.readFileSync(specPath, 'utf-8');
        return yaml.load(raw) as Record<string, unknown>;
    } catch {
        logger.warn('[Swagger] openapi.yaml not found — serving minimal spec');
        return {
            openapi: '3.0.3',
            info: { title: 'TestOps Companion API', version: '1.0.0' },
            paths: {},
        };
    }
}

export const swaggerSpec = loadSpec();
