/**
 * Query Hooks — barrel export.
 *
 * Every React Query useQuery / useMutation is centralised here
 * so page components stay lean and cache keys stay consistent.
 */

export { queryKeys } from './queryKeys';

// Domain hooks
export { usePipelines, usePipeline, usePipelineTestRuns, useCreatePipeline, useUpdatePipeline, useDeletePipeline } from './usePipelines';
export { useTestRuns, useTestRun } from './useTestRuns';
export { useSettings, useUpdateSettings } from './useSettings';
export { useUnreadNotifications, useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, useMarkNotificationAsDelivered, useDeleteNotification, useClearAllNotifications, type AppNotification } from './useNotifications';
export { useAutonomyPreference, useUpdateAutonomy, useCostMetrics, useAIQuota } from './useAIConfig';
export { useDashboardMetrics } from './useDashboard';
export { useFlakyTests } from './useFlakyTests';
export { useFailureInsights, useFailureSearch, useFailureComments, useAddFailureComment, useDeleteFailureComment } from './useFailureArchive';
export { useTeams, useTeamDetail, useCreateTeam, useAddTeamMember, useRemoveTeamMember, useUpdateTeamMemberRole } from './useTeams';
export { useProviderConfig, useTestProviderConnection, useSaveProviderConfig, type ProviderConfig } from './useProviderConfig';
export { useHealingRules, useHealingEvents, useHealingStats, useCreateHealingRule, useUpdateHealingRule, useToggleHealingRule, useDeleteHealingRule, useEvaluateHealing, useExecuteHealing, useSeedHealingRules, useQuarantinedTests, useQuarantineTest, useReinstateTest, useDeleteQuarantinedTest, useFixSuggestions, type HealingRule, type HealingEvent, type HealingStats, type QuarantinedTest, type FixSuggestion } from './useHealing';
export { useStarterPrompts, useStarterPromptCatalog, useSavePinnedPrompts, useResetPinnedPrompts, type StarterPrompt, type PinnedPromptEntry } from './useStarterPrompts';
export { useXrayTestConnection, useXrayTestCases, useXrayTestPlans, useXraySyncTestRun, useXraySyncHistory, useXraySyncStatus, type XrayTestCase, type XrayTestPlan, type XraySyncRecord, type XraySyncResult } from './useXray';
