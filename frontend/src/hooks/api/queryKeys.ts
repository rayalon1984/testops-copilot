/**
 * Query Key Factory
 *
 * Single source of truth for all React Query cache keys.
 * Using the factory pattern keeps keys co-located, typesafe,
 * and makes invalidation predictable.
 *
 * Convention:
 *   queryKeys.domain.all()       → list / collection queries
 *   queryKeys.domain.detail(id)  → single-entity queries
 *   queryKeys.domain.list(filters) → filtered list queries
 */

export const queryKeys = {
  pipelines: {
    all: () => ['pipelines'] as const,
    detail: (id: string | undefined) => ['pipeline', id] as const,
    testRuns: (id: string | undefined) => ['pipeline', id, 'test-runs'] as const,
  },

  testRuns: {
    all: () => ['test-runs'] as const,
    list: (filters: { page: number; limit: number; status?: string; search?: string }) =>
      ['test-runs', filters.page, filters.limit, filters.status ?? 'all', filters.search ?? ''] as const,
    detail: (id: string | undefined) => ['test-run', id] as const,
  },

  settings: {
    all: () => ['settings'] as const,
  },

  notifications: {
    all: () => ['notifications'] as const,
    unread: () => ['notifications', 'unread'] as const,
    list: (undeliveredOnly: boolean) => ['notifications', undeliveredOnly] as const,
  },

  ai: {
    autonomy: () => ['autonomy-preference'] as const,
    quota: () => ['ai-quota'] as const,
    costMetrics: (timeRange: string) => ['cost-metrics', timeRange] as const,
  },

  dashboard: {
    metrics: () => ['dashboard', 'ai-metrics'] as const,
  },

  tests: {
    flaky: () => ['flakyTests'] as const,
  },

  auth: {
    me: () => ['auth', 'me'] as const,
    all: () => ['auth'] as const,
  },

  teams: {
    all: () => ['teams'] as const,
    detail: (id: string | undefined) => ['team', id] as const,
  },

  aiConfig: {
    current: () => ['ai-config'] as const,
  },

  healing: {
    rules: () => ['healing-rules'] as const,
    events: (filters?: { pipelineId?: string; limit?: number }) => ['healing-events', filters] as const,
    stats: () => ['healing-stats'] as const,
  },
} as const;
