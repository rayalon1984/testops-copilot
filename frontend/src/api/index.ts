/**
 * API barrel — re-exports for clean imports.
 *
 * Usage:
 *   import { api, ApiError } from '../api';
 *   import type { ApiSchemas } from '../api';
 *
 *   const pipelines = await api.get<ApiSchemas['Pipeline'][]>('/pipelines');
 */

export { api, ApiError } from './client';
export type { components, paths } from './generated';

/**
 * Convenience alias: use `ApiSchemas['Pipeline']` instead of
 * `components['schemas']['Pipeline']`.
 */
export type ApiSchemas = import('./generated').components['schemas'];
